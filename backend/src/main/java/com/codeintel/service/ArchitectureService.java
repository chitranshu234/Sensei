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

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ArchitectureService {

    private final CodeEntityRepo codeEntityRepo;
    private final CodeRelationshipRepo codeRelationshipRepo;

    public ArchitectureService(CodeEntityRepo codeEntityRepo,
                               CodeRelationshipRepo codeRelationshipRepo) {
        this.codeEntityRepo = codeEntityRepo;
        this.codeRelationshipRepo = codeRelationshipRepo;
    }

    /**
     * Build the full architecture graph for a repository.
     * Returns nodes (classes/interfaces with Spring types) and edges (inject/call/extend/implement).
     */
    public ArchitectureResponse getArchitectureGraph(Long repoId) {
        List<CodeEntity> entities = codeEntityRepo.findByRepoId(repoId);
        List<CodeRelationshipEntity> relationships = codeRelationshipRepo.findByRepoId(repoId);

        // Build node map
        Map<String, CodeEntity> nameToEntity = new HashMap<>();
        for (CodeEntity e : entities) {
            nameToEntity.put(e.getName(), e);
            if (e.getQualifiedName() != null) {
                nameToEntity.put(e.getQualifiedName(), e);
            }
        }

        // Create nodes
        List<ArchNode> nodes = entities.stream()
                .map(e -> {
                    ArchNode node = new ArchNode(
                            String.valueOf(e.getId() != null ? e.getId() : e.getName().hashCode()),
                            e.getName(),
                            e.getEntityType().name()
                    );
                    node.setPackageName(e.getPackageName());
                    node.setFilePath(e.getFilePath());
                    return node;
                })
                .collect(Collectors.toList());

        // Create edges, resolving names to IDs
        List<ArchEdge> edges = new ArrayList<>();
        int edgeCounter = 0;
        for (CodeRelationshipEntity rel : relationships) {
            CodeEntity source = resolveEntity(nameToEntity, rel.getSourceName());
            CodeEntity target = resolveEntity(nameToEntity, rel.getTargetName());
            if (source != null && target != null) {
                String sourceId = String.valueOf(source.getId() != null ? source.getId() : source.getName().hashCode());
                String targetId = String.valueOf(target.getId() != null ? target.getId() : target.getName().hashCode());
                edges.add(new ArchEdge(
                        "e" + (edgeCounter++),
                        sourceId,
                        targetId,
                        rel.getRelationType().name().toLowerCase(),
                        rel.getRelationType().name()
                ));
            }
        }

        return new ArchitectureResponse(nodes, edges);
    }

    /**
     * Get only the Spring layer architecture (Controller → Service → Repository → Entity).
     */
    public ArchitectureResponse getSpringLayerGraph(Long repoId) {
        List<EntityType> springTypes = List.of(
                EntityType.REST_CONTROLLER, EntityType.CONTROLLER,
                EntityType.SERVICE, EntityType.REPOSITORY, EntityType.ENTITY,
                EntityType.CONFIGURATION, EntityType.COMPONENT
        );
        List<CodeEntity> entities = codeEntityRepo.findByRepoIdAndEntityTypeIn(repoId, springTypes);
        List<CodeRelationshipEntity> relationships = codeRelationshipRepo.findByRepoIdAndRelationType(
                repoId, RelationType.INJECTS);

        Map<String, CodeEntity> nameToEntity = new HashMap<>();
        for (CodeEntity e : entities) {
            nameToEntity.put(e.getName(), e);
            if (e.getQualifiedName() != null) {
                nameToEntity.put(e.getQualifiedName(), e);
            }
        }

        List<ArchNode> nodes = entities.stream()
                .map(e -> {
                    ArchNode node = new ArchNode(
                            String.valueOf(e.getId() != null ? e.getId() : e.getName().hashCode()),
                            e.getName(),
                            e.getEntityType().name()
                    );
                    node.setPackageName(e.getPackageName());
                    node.setFilePath(e.getFilePath());
                    return node;
                })
                .collect(Collectors.toList());

        List<ArchEdge> edges = new ArrayList<>();
        int edgeCounter = 0;
        for (CodeRelationshipEntity rel : relationships) {
            CodeEntity source = resolveEntity(nameToEntity, rel.getSourceName());
            CodeEntity target = resolveEntity(nameToEntity, rel.getTargetName());
            if (source != null && target != null) {
                String sourceId = String.valueOf(source.getId() != null ? source.getId() : source.getName().hashCode());
                String targetId = String.valueOf(target.getId() != null ? target.getId() : target.getName().hashCode());
                edges.add(new ArchEdge(
                        "e" + (edgeCounter++),
                        sourceId, targetId,
                        "injects",
                        "INJECTS"
                ));
            }
        }

        return new ArchitectureResponse(nodes, edges);
    }

    private CodeEntity resolveEntity(Map<String, CodeEntity> nameToEntity, String name) {
        if (name == null) return null;
        CodeEntity entity = nameToEntity.get(name);
        if (entity != null) return entity;
        int lastDot = name.lastIndexOf('.');
        if (lastDot >= 0) {
            return nameToEntity.get(name.substring(lastDot + 1));
        }
        return null;
    }
}
