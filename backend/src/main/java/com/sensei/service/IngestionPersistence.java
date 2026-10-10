package com.sensei.service;

import com.sensei.model.AnalysisResult;
import com.sensei.repository.CodeChunkRepo;
import com.sensei.repository.CodeEntityRepo;
import com.sensei.repository.CodeFileRepo;
import com.sensei.repository.CodeRelationshipRepo;
import com.sensei.repository.RepositoryRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional write boundary for a parsed repository.
 *
 * <p>This exists as its own bean on purpose. Annotating a method on
 * {@link IngestionService} with {@code @Transactional} and calling it from inside that same
 * class would run it through {@code this}, bypassing the Spring proxy — so the annotation would
 * do nothing and a mid-save failure would leave half-written rows behind. Splitting it out
 * guarantees the whole analysis lands atomically, or not at all.
 */
@Service
public class IngestionPersistence {

    private static final Logger log = LoggerFactory.getLogger(IngestionPersistence.class);

    private final CodeFileRepo codeFileRepo;
    private final CodeEntityRepo codeEntityRepo;
    private final CodeRelationshipRepo codeRelationshipRepo;
    private final CodeChunkRepo codeChunkRepo;
    private final RepositoryRepo repositoryRepo;

    public IngestionPersistence(CodeFileRepo codeFileRepo,
                                CodeEntityRepo codeEntityRepo,
                                CodeRelationshipRepo codeRelationshipRepo,
                                CodeChunkRepo codeChunkRepo,
                                RepositoryRepo repositoryRepo) {
        this.codeFileRepo = codeFileRepo;
        this.codeEntityRepo = codeEntityRepo;
        this.codeRelationshipRepo = codeRelationshipRepo;
        this.codeChunkRepo = codeChunkRepo;
        this.repositoryRepo = repositoryRepo;
    }

    /**
     * Persist a full analysis result in one transaction.
     *
     * <p>Re-ingesting an existing repository clears its previous rows first, otherwise a
     * second run would silently duplicate every file, entity and chunk.
     */
    @Transactional
    public boolean saveAll(Long repoId, AnalysisResult analysis) {
        // Coordinate this write with deletion. If the delete committed first, this ingestion
        // belongs to a repository the user has removed and must not recreate derived rows.
        if (repositoryRepo.findByIdForUpdate(repoId).isEmpty()) {
            log.info("Skipping persistence for deleted repository {}", repoId);
            return false;
        }

        clearExisting(repoId);

        codeFileRepo.saveAll(analysis.files);
        codeEntityRepo.saveAll(analysis.entities);
        codeRelationshipRepo.saveAll(analysis.relationships);
        codeChunkRepo.saveAll(analysis.chunks);

        log.info("Persisted repo {}: {} files, {} entities, {} relationships, {} chunks",
                repoId, analysis.files.size(), analysis.entities.size(),
                analysis.relationships.size(), analysis.chunks.size());
        return true;
    }

    @Transactional
    public void clearExisting(Long repoId) {
        codeChunkRepo.deleteByRepoId(repoId);
        codeRelationshipRepo.deleteByRepoId(repoId);
        codeEntityRepo.deleteByRepoId(repoId);
        codeFileRepo.deleteByRepoId(repoId);
    }
}
