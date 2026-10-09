package com.codeintel.service;

import com.codeintel.model.AnalysisResult;
import com.codeintel.repository.CodeChunkRepo;
import com.codeintel.repository.CodeEntityRepo;
import com.codeintel.repository.CodeFileRepo;
import com.codeintel.repository.CodeRelationshipRepo;
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

    public IngestionPersistence(CodeFileRepo codeFileRepo,
                                CodeEntityRepo codeEntityRepo,
                                CodeRelationshipRepo codeRelationshipRepo,
                                CodeChunkRepo codeChunkRepo) {
        this.codeFileRepo = codeFileRepo;
        this.codeEntityRepo = codeEntityRepo;
        this.codeRelationshipRepo = codeRelationshipRepo;
        this.codeChunkRepo = codeChunkRepo;
    }

    /**
     * Persist a full analysis result in one transaction.
     *
     * <p>Re-ingesting an existing repository clears its previous rows first, otherwise a
     * second run would silently duplicate every file, entity and chunk.
     */
    @Transactional
    public void saveAll(Long repoId, AnalysisResult analysis) {
        clearExisting(repoId);

        codeFileRepo.saveAll(analysis.files);
        codeEntityRepo.saveAll(analysis.entities);
        codeRelationshipRepo.saveAll(analysis.relationships);
        codeChunkRepo.saveAll(analysis.chunks);

        log.info("Persisted repo {}: {} files, {} entities, {} relationships, {} chunks",
                repoId, analysis.files.size(), analysis.entities.size(),
                analysis.relationships.size(), analysis.chunks.size());
    }

    @Transactional
    public void clearExisting(Long repoId) {
        codeChunkRepo.deleteByRepoId(repoId);
        codeRelationshipRepo.deleteByRepoId(repoId);
        codeEntityRepo.deleteByRepoId(repoId);
        codeFileRepo.deleteByRepoId(repoId);
    }
}
