package com.codeintel.service;

import com.codeintel.dto.RepositoryResponse;
import com.codeintel.entity.*;
import com.codeintel.model.RepoStatus;
import com.codeintel.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RepositoryService {

    private static final Logger log = LoggerFactory.getLogger(RepositoryService.class);

    private final RepositoryRepo repositoryRepo;
    private final CodeFileRepo codeFileRepo;
    private final CodeEntityRepo codeEntityRepo;
    private final CodeRelationshipRepo codeRelationshipRepo;
    private final CodeChunkRepo codeChunkRepo;
    private final IngestionService ingestionService;

    public RepositoryService(RepositoryRepo repositoryRepo,
                             CodeFileRepo codeFileRepo,
                             CodeEntityRepo codeEntityRepo,
                             CodeRelationshipRepo codeRelationshipRepo,
                             CodeChunkRepo codeChunkRepo,
                             IngestionService ingestionService) {
        this.repositoryRepo = repositoryRepo;
        this.codeFileRepo = codeFileRepo;
        this.codeEntityRepo = codeEntityRepo;
        this.codeRelationshipRepo = codeRelationshipRepo;
        this.codeChunkRepo = codeChunkRepo;
        this.ingestionService = ingestionService;
    }

    /**
     * Submit a new repository for ingestion. Returns immediately with QUEUED status.
     * If the repo was previously FAILED, resets it and retries.
     */
    public RepositoryResponse submitRepository(String githubUrl, String branch) {
        // Check if already ingested
        if (repositoryRepo.existsByGithubUrl(githubUrl)) {
            RepositoryEntity existing = repositoryRepo.findByGithubUrl(githubUrl).orElseThrow();

            // Allow re-submission of FAILED repos
            if (existing.getStatus() == RepoStatus.FAILED) {
                log.info("Re-submitting previously failed repo: {}", githubUrl);
                existing.setStatus(RepoStatus.QUEUED);
                existing.setErrorMessage(null);
                existing.setDefaultBranch(branch != null && !branch.trim().isEmpty() ? branch : existing.getDefaultBranch());
                existing = repositoryRepo.save(existing);

                // Kick off async ingestion in separate bean (proper @Async)
                ingestionService.ingestAsync(existing.getId());

                return RepositoryResponse.from(existing);
            }

            return RepositoryResponse.from(existing);
        }

        String name = extractName(githubUrl);
        RepositoryEntity repo = new RepositoryEntity();
        repo.setName(name);
        repo.setGithubUrl(githubUrl);
        repo.setDefaultBranch(branch != null && !branch.trim().isEmpty() ? branch : null);
        repo.setStatus(RepoStatus.QUEUED);
        repo = repositoryRepo.save(repo);

        // Kick off async ingestion in separate bean (proper @Async)
        ingestionService.ingestAsync(repo.getId());

        return RepositoryResponse.from(repo);
    }

    public List<RepositoryResponse> getAllRepositories() {
        return repositoryRepo.findAll().stream()
                .map(RepositoryResponse::from)
                .toList();
    }

    public RepositoryResponse getRepository(Long id) {
        return repositoryRepo.findById(id)
                .map(RepositoryResponse::from)
                .orElseThrow(() -> new RuntimeException("Repository not found: " + id));
    }

    @Transactional
    public void deleteRepository(Long id) {
        codeChunkRepo.deleteByRepoId(id);
        codeRelationshipRepo.deleteByRepoId(id);
        codeEntityRepo.deleteByRepoId(id);
        codeFileRepo.deleteByRepoId(id);
        repositoryRepo.deleteById(id);
    }

    private String extractName(String githubUrl) {
        String cleaned = githubUrl.replaceAll("/$", "");
        String[] parts = cleaned.split("/");
        return parts[parts.length - 1];
    }
}
