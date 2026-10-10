package com.sensei.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/** Performs non-essential repository cleanup outside the DELETE response path. */
@Service
public class RepositoryCleanupService {

    private static final Logger log = LoggerFactory.getLogger(RepositoryCleanupService.class);

    private final GitCloneService gitCloneService;
    private final AiServiceClient aiServiceClient;

    public RepositoryCleanupService(GitCloneService gitCloneService, AiServiceClient aiServiceClient) {
        this.gitCloneService = gitCloneService;
        this.aiServiceClient = aiServiceClient;
    }

    /**
     * Removing a large working tree and waiting for a remote Render service can take a while.
     * The workspace record and its database data are already gone when this begins.
     */
    @Async("ingestionExecutor")
    public void cleanupAsync(Long repoId, String clonePath) {
        if (clonePath != null && !clonePath.isBlank()) {
            try {
                gitCloneService.deleteClone(clonePath);
            } catch (Exception e) {
                log.warn("Could not remove clone at {}: {}", clonePath, e.getMessage());
            }
        }
        aiServiceClient.deleteRepo(repoId);
    }
}
