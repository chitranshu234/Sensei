package com.codeintel.service;

import com.codeintel.dto.ArchitectureResponse;
import com.codeintel.dto.ArchitectureResponse.ArchEdge;
import com.codeintel.dto.ArchitectureResponse.ArchNode;
import com.codeintel.entity.CodeEntity;
import com.codeintel.entity.CodeRelationshipEntity;
import com.codeintel.model.EntityType;
import com.codeintel.model.RelationType;
import com.codeintel.repository.CodeEntityRepo;
import com.codeintel.repository.CodeRelationshipRepo;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Builds the node/edge graph the UI renders with React Flow.
 *
 * <p>The hard part of this class is <b>name resolution</b>. Relationships are recorded by the
 * analyzers using whatever name appeared at the call site — sometimes a fully-qualified name
 * ({@code com.acme.UserService}), sometimes a bare simple name ({@code UserService}). Entities
 * are stored with both. Resolution therefore tries, in order: exact match on qualified name,
 * exact match on simple name, then a last-segment match after stripping a package prefix.
 *
 * <p>A second, subtler problem is <b>duplicate simple names</b>. A real codebase can hold
 * {@code com.acme.user.UserRepository} and {@code com.acme.order.UserRepository} at once. Plain
 * simple-name keys would let the second silently overwrite the first, rewiring edges to the wrong
 * node. Names are therefore stored in multi-valued maps and the shortest qualified name wins a
 * tie — deterministically, so the graph never reshuffles between requests.
 */
@Service
public class ArchitectureService {

    /** Node types included in the "Spring layers" view. */
    private static final List<EntityType> SPRING_LAYER_TYPES = List.of(
            EntityType.REST_CONTROLLER,
            EntityType.CONTROLLER,
            EntityType.SERVICE,
            EntityType.REPOSITORY,
            EntityType.ENTITY,
            EntityType.CONFIGURATION,
            EntityType.COMPONENT
    );

    /** Relationship types meaningful in the Spring-layer view. */
    private static final Set<RelationType> SPRING_LAYER_RELATIONS =
            EnumSet.of(RelationType.INJECTS, RelationType.EXTENDS, RelationType.IMPLEMENTS);

    private final CodeEntityRepo codeEntityRepo;
    private final CodeRelationshipRepo codeRelationshipRepo;

    public ArchitectureService(CodeEntityRepo codeEntityRepo,
                               CodeRelationshipRepo codeRelationshipRepo) {
        this.codeEntityRepo = codeEntityRepo;
        this.codeRelationshipRepo = codeRelationshipRepo;
    }

    /** Full architecture graph: every discovered entity and relationship. */
    public ArchitectureResponse getArchitectureGraph(Long repoId) {
        return buildGraph(
                codeEntityRepo.findByRepoId(repoId),
                codeRelationshipRepo.findByRepoId(repoId),
                null
        );
    }

    /**
     * Spring-layer view: Controllers → Services → Repositories → Entities, showing only
     * wiring relationships so the dependency direction is legible.
     */
    public ArchitectureResponse getSpringLayerGraph(Long repoId) {
        List<CodeEntity> entities = codeEntityRepo.findByRepoIdAndEntityTypeIn(repoId, SPRING_LAYER_TYPES);

        // A repository with no Spring annotations at all (e.g. a plain Node project) should
        // yield an empty graph rather than a misleadingly truncated one — the UI detects the
        // emptiness and falls back to the full graph on its own.
        if (entities.isEmpty()) {
            return new ArchitectureResponse(new ArrayList<>(), new ArrayList<>());
        }

        List<CodeRelationshipEntity> relationships = codeRelationshipRepo.findByRepoId(repoId).stream()
                .filter(rel -> SPRING_LAYER_RELATIONS.contains(rel.getRelationType()))
                .toList();

        return buildGraph(entities, relationships, SPRING_LAYER_RELATIONS);
    }

    /**
     * Shared graph construction.
     *
     * @param relationFilter when non-null, only these relationship types are drawn as edges
     */
    private ArchitectureResponse buildGraph(List<CodeEntity> entities,
                                            List<CodeRelationshipEntity> relationships,
                                            Set<RelationType> relationFilter) {

        NameIndex index = NameIndex.of(entities);

        List<ArchNode> nodes = new ArrayList<>(entities.size());
        Set<String> emittedNodeIds = new HashSet<>();
        for (CodeEntity entity : entities) {
            String nodeId = nodeId(entity);
            if (!emittedNodeIds.add(nodeId)) {
                continue; // two entities collapsed onto one id; keep the first
            }
            ArchNode node = new ArchNode(nodeId, entity.getName(), entity.getEntityType().name());
            node.setPackageName(entity.getPackageName());
            node.setFilePath(entity.getFilePath());
            nodes.add(node);
        }

        List<ArchEdge> edges = new ArrayList<>();
        Set<String> emittedEdges = new HashSet<>();
        int counter = 0;

        for (CodeRelationshipEntity rel : relationships) {
            if (relationFilter != null && !relationFilter.contains(rel.getRelationType())) {
                continue;
            }

            CodeEntity source = index.resolve(rel.getSourceName());
            CodeEntity target = index.resolve(rel.getTargetName());

            // Both endpoints must exist in the node set, otherwise React Flow would receive an
            // edge pointing at a node it does not have and drop it (or warn) at render time.
            if (source == null || target == null) {
                continue;
            }
            String sourceId = nodeId(source);
            String targetId = nodeId(target);
            if (!emittedNodeIds.contains(sourceId) || !emittedNodeIds.contains(targetId)) {
                continue;
            }
            if (sourceId.equals(targetId)) {
                continue; // self-loops add noise without information
            }

            String dedupeKey = sourceId + "->" + targetId + ":" + rel.getRelationType();
            if (!emittedEdges.add(dedupeKey)) {
                continue;
            }

            String type = rel.getRelationType().name();
            edges.add(new ArchEdge("e" + (counter++), sourceId, targetId, type.toLowerCase(), type));
        }

        return new ArchitectureResponse(nodes, edges);
    }

    /**
     * Stable node identity. The database id is preferred; the qualified name is the fallback
     * so an entity that somehow lacks an id still gets a unique, reproducible key.
     */
    private String nodeId(CodeEntity entity) {
        if (entity.getId() != null) {
            return String.valueOf(entity.getId());
        }
        String qualified = entity.getQualifiedName();
        return qualified != null && !qualified.isBlank()
                ? qualified
                : String.valueOf(entity.getName());
    }

    /**
     * Multi-valued lookup from any name a relationship might use to the entity it denotes.
     *
     * <p>Built once per request rather than per edge, which matters on large repositories where
     * the relationship list runs to tens of thousands of rows.
     */
    private static final class NameIndex {

        private final Map<String, CodeEntity> byExactName = new HashMap<>();
        private final Map<String, CodeEntity> bySimpleName = new HashMap<>();

        private NameIndex() {}

        static NameIndex of(List<CodeEntity> entities) {
            NameIndex index = new NameIndex();
            for (CodeEntity entity : entities) {
                String qualified = entity.getQualifiedName();
                if (qualified != null && !qualified.isBlank()) {
                    index.byExactName.merge(qualified, entity, NameIndex::preferShorterQualifiedName);
                }
                String name = entity.getName();
                if (name != null && !name.isBlank()) {
                    index.byExactName.merge(name, entity, NameIndex::preferShorterQualifiedName);
                    index.bySimpleName.merge(name, entity, NameIndex::preferShorterQualifiedName);
                }
            }
            return index;
        }

        /** Deterministic tie-break: shorter qualified name, then lower id. */
        private static CodeEntity preferShorterQualifiedName(CodeEntity a, CodeEntity b) {
            String qa = a.getQualifiedName() == null ? "" : a.getQualifiedName();
            String qb = b.getQualifiedName() == null ? "" : b.getQualifiedName();
            int byLength = Integer.compare(qa.length(), qb.length());
            if (byLength != 0) {
                return byLength < 0 ? a : b;
            }
            long ida = a.getId() == null ? Long.MAX_VALUE : a.getId();
            long idb = b.getId() == null ? Long.MAX_VALUE : b.getId();
            return ida <= idb ? a : b;
        }

        /** Resolve a relationship endpoint name to an entity, or null when unresolvable. */
        CodeEntity resolve(String name) {
            if (name == null || name.isBlank()) {
                return null;
            }
            CodeEntity exact = byExactName.get(name);
            if (exact != null) {
                return exact;
            }
            int lastDot = name.lastIndexOf('.');
            if (lastDot >= 0 && lastDot < name.length() - 1) {
                CodeEntity simple = bySimpleName.get(name.substring(lastDot + 1));
                if (simple != null) {
                    return simple;
                }
            }
            return null;
        }
    }
}
