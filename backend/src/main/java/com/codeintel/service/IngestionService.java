package com.codeintel.service;

import com.codeintel.analyzer.LanguageAnalyzer;
import com.codeintel.entity.*;
import com.codeintel.model.AnalysisResult;
import com.codeintel.model.RepoStatus;
import com.codeintel.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;

@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);

    private final RepositoryRepo repositoryRepo;
    private final CodeFileRepo codeFileRepo;
    private final CodeEntityRepo codeEntityRepo;
    private final CodeRelationshipRepo codeRelationshipRepo;
    private final CodeChunkRepo codeChunkRepo;
    private final GitCloneService gitCloneService;
    private final List<LanguageAnalyzer> analyzers;
    private final AiServiceClient aiServiceClient;

    public IngestionService(RepositoryRepo repositoryRepo,
                            CodeFileRepo codeFileRepo,
                            CodeEntityRepo codeEntityRepo,
                            CodeRelationshipRepo codeRelationshipRepo,
                            CodeChunkRepo codeChunkRepo,
                            GitCloneService gitCloneService,
                            List<LanguageAnalyzer> analyzers,
                            AiServiceClient aiServiceClient) {
        this.repositoryRepo = repositoryRepo;
        this.codeFileRepo = codeFileRepo;
        this.codeEntityRepo = codeEntityRepo;
        this.codeRelationshipRepo = codeRelationshipRepo;
        this.codeChunkRepo = codeChunkRepo;
        this.gitCloneService = gitCloneService;
        this.analyzers = analyzers;
        this.aiServiceClient = aiServiceClient;
    }

    /**
     * Async ingestion pipeline: clone → parse → index.
     * Runs in a separate thread via Spring's @Async proxy.
     */
    @Async("ingestionExecutor")
    public void ingestAsync(Long repoId) {
        RepositoryEntity repo = repositoryRepo.findById(repoId).orElse(null);
        if (repo == null) return;

        try {
            // Step 1: Clone
            updateStatus(repo, RepoStatus.CLONING);
            
            String branchToClone = repo.getDefaultBranch();
            if (branchToClone == null || branchToClone.isBlank()) {
                branchToClone = gitCloneService.detectDefaultBranch(repo.getGithubUrl());
                repo.setDefaultBranch(branchToClone);
                repositoryRepo.save(repo);
            }
            
            String clonePath = gitCloneService.cloneRepository(repo.getGithubUrl(), branchToClone);
            repo.setClonePath(clonePath);
            repositoryRepo.save(repo);

            // Step 2: Parse
            updateStatus(repo, RepoStatus.PARSING);
            AnalysisResult analysis = new AnalysisResult();
            
            Path root = Path.of(clonePath);
            try {
                Files.walkFileTree(root, new SimpleFileVisitor<>() {
                    @Override
                    public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                        String fileName = file.toString();
                        for (LanguageAnalyzer analyzer : analyzers) {
                            if (analyzer.supports(fileName)) {
                                analyzer.analyzeFile(repoId, file, root, analysis);
                                break;
                            }
                        }
                        return FileVisitResult.CONTINUE;
                    }
                });
            } catch (IOException e) {
                log.error("Error walking directory {}: {}", clonePath, e.getMessage());
            }

            // Save all parsed data
            saveAnalysisResults(repoId, analysis);

            // Update stats
            repo.setTotalFiles(analysis.files.size());
            repo.setTotalClasses(analysis.entities.size());
            repo.setTotalMethods((int) analysis.chunks.stream()
                    .filter(c -> "METHOD".equals(c.getChunkType())).count());
            repo.setTotalRelationships(analysis.relationships.size());

            // Step 3: Index (send chunks to AI service for embedding)
            updateStatus(repo, RepoStatus.INDEXING);
            try {
                aiServiceClient.indexChunks(repoId, analysis.chunks);
            } catch (Exception e) {
                log.warn("AI service indexing failed (non-fatal): {}", e.getMessage());
                // Non-fatal — the system still works without AI, just no semantic search
            }

            // Done
            updateStatus(repo, RepoStatus.READY);
            log.info("Repository {} ingestion complete", repo.getName());

        } catch (Exception e) {
            log.error("Ingestion failed for repo {}: {}", repoId, e.getMessage(), e);
            repo.setStatus(RepoStatus.FAILED);
            repo.setErrorMessage(e.getMessage());
            repositoryRepo.save(repo);
        }
    }

    @Transactional
    protected void saveAnalysisResults(Long repoId, AnalysisResult analysis) {
        codeFileRepo.saveAll(analysis.files);
        codeEntityRepo.saveAll(analysis.entities);
        codeRelationshipRepo.saveAll(analysis.relationships);
        codeChunkRepo.saveAll(analysis.chunks);
    }

    private void updateStatus(RepositoryEntity repo, RepoStatus status) {
        repo.setStatus(status);
        repositoryRepo.save(repo);
    }
}
