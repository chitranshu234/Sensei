package com.sensei.service;

import com.sensei.dto.RepositoryResponse;
import com.sensei.entity.RepositoryEntity;
import com.sensei.exception.BadRequestException;
import com.sensei.exception.ResourceNotFoundException;
import com.sensei.model.RepoStatus;
import com.sensei.repository.RepositoryRepo;
import com.sensei.entity.UserEntity;
import com.sensei.repository.UserRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Comparator;
import java.util.List;

/**
 * Repository lifecycle: submit, list, fetch, delete.
 *
 * <p>Submission is deliberately <b>non-blocking</b>. Cloning and parsing a large repo takes
 * anywhere from seconds to minutes, so the endpoint persists a QUEUED row and returns
 * immediately; the client then polls for status transitions. That keeps HTTP requests short
 * and moves the long work onto the dedicated ingestion pool.
 */
@Service
public class RepositoryService {

    private static final Logger log = LoggerFactory.getLogger(RepositoryService.class);

    private final RepositoryRepo repositoryRepo;
    private final IngestionService ingestionService;
    private final IngestionPersistence persistence;
    private final UserRepo userRepo;
    private final RepositoryCleanupService repositoryCleanupService;

    public RepositoryService(RepositoryRepo repositoryRepo,
                             IngestionService ingestionService,
                              IngestionPersistence persistence,
                              UserRepo userRepo,
                              RepositoryCleanupService repositoryCleanupService) {
        this.repositoryRepo = repositoryRepo;
        this.ingestionService = ingestionService;
        this.persistence = persistence;
        this.userRepo = userRepo;
        this.repositoryCleanupService = repositoryCleanupService;
    }

    private UserEntity getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Current user not found"));
    }

    /**
     * Register a repository and start ingestion.
     *
     * <p>Registering a URL that already exists is idempotent: a READY or in-flight repo is
     * returned as-is (so a double-click cannot queue the same clone twice), while a FAILED one
     * is reset and retried.
     */
    public RepositoryResponse submitRepository(String githubUrl, String branch) {
        if ("true".equals(System.getenv("DEMO_MODE"))) {
            UserEntity user = getCurrentUser();
            if (user.getRole() != com.sensei.model.Role.ADMIN) {
                throw new BadRequestException("Repository ingestion is restricted in the live demo to prevent abuse. Please interact with the pre-indexed demo repositories or run the project locally.");
            }
        }
        String normalizedUrl = normalizeUrl(githubUrl);
        String requestedBranch = blankToNull(branch);

        return repositoryRepo.findByGithubUrlAndUser(normalizedUrl, getCurrentUser())
                .map(existing -> resubmitIfFailed(existing, requestedBranch))
                .orElseGet(() -> createAndStart(normalizedUrl, requestedBranch));
    }

    private RepositoryResponse resubmitIfFailed(RepositoryEntity existing, String branch) {
        if (existing.getStatus() != RepoStatus.FAILED) {
            log.info("Repository already registered (status {}): {}", existing.getStatus(), existing.getGithubUrl());
            return RepositoryResponse.from(existing);
        }

        log.info("Re-submitting previously failed repo: {}", existing.getGithubUrl());
        existing.setStatus(RepoStatus.QUEUED);
        existing.setErrorMessage(null);
        if (branch != null) {
            existing.setDefaultBranch(branch);
        }
        RepositoryEntity saved = repositoryRepo.save(existing);
        ingestionService.ingestAsync(saved.getId());
        return RepositoryResponse.from(saved);
    }

    private RepositoryResponse createAndStart(String githubUrl, String branch) {
        RepositoryEntity repo = new RepositoryEntity();
        repo.setName(extractName(githubUrl));
        repo.setGithubUrl(githubUrl);
        repo.setDefaultBranch(branch);
        repo.setStatus(RepoStatus.QUEUED);
        repo.setUser(getCurrentUser());
        RepositoryEntity saved = repositoryRepo.save(repo);

        log.info("Queued repository {} (id {})", saved.getName(), saved.getId());
        ingestionService.ingestAsync(saved.getId());
        return RepositoryResponse.from(saved);
    }

    /** All repositories, newest first — the order the dashboard expects. */
    public List<RepositoryResponse> getAllRepositories() {
        if ("true".equals(System.getenv("DEMO_MODE"))) {
            return repositoryRepo.findAllByOrderByIdDesc().stream()
                    .map(RepositoryResponse::from)
                    .toList();
        }
        return repositoryRepo.findByUserOrderByIdDesc(getCurrentUser()).stream()
                .map(RepositoryResponse::from)
                .toList();
    }

    public RepositoryResponse getRepository(Long id) {
        if ("true".equals(System.getenv("DEMO_MODE"))) {
            return repositoryRepo.findById(id)
                    .map(RepositoryResponse::from)
                    .orElseThrow(() -> ResourceNotFoundException.repository(id));
        }
        return repositoryRepo.findByIdAndUser(id, getCurrentUser())
                .map(RepositoryResponse::from)
                .orElseThrow(() -> ResourceNotFoundException.repository(id));
    }

    /**
     * Delete a repository along with every derived row and the cloned working copy on disk.
     *
     * <p>The disk cleanup matters: without it, deleted repositories leak their full source
     * tree under {@code storage/repos} forever.
     */
    @Transactional
    public void deleteRepository(Long id) {
        RepositoryEntity repo = repositoryRepo.findByIdAndUser(id, getCurrentUser())
                .orElseThrow(() -> ResourceNotFoundException.repository(id));

        String clonePath = repo.getClonePath();

        persistence.clearExisting(id);
        repositoryRepo.delete(repo);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                repositoryCleanupService.cleanupAsync(id, clonePath);
            }
        });
        log.info("Deleted repository {} and all derived data; background cleanup scheduled", id);
    }

    /** Strip a trailing slash and a trailing {@code .git} so equivalent URLs deduplicate. */
    private String normalizeUrl(String githubUrl) {
        if (githubUrl == null || githubUrl.isBlank()) {
            throw new BadRequestException("GitHub URL is required");
        }
        String normalized = githubUrl.trim().replaceAll("/+$", "");
        if (normalized.endsWith(".git")) {
            normalized = normalized.substring(0, normalized.length() - 4);
        }
        return normalized;
    }

    private String extractName(String githubUrl) {
        String[] parts = githubUrl.split("/");
        return parts.length > 0 ? parts[parts.length - 1] : "repository";
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
