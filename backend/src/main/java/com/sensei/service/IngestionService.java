package com.sensei.service;

import com.sensei.analyzer.LanguageAnalyzer;
import com.sensei.entity.RepositoryEntity;
import com.sensei.model.AnalysisResult;
import com.sensei.model.RepoStatus;
import com.sensei.repository.CodeChunkRepo;
import com.sensei.repository.CodeEntityRepo;
import com.sensei.repository.CodeFileRepo;
import com.sensei.repository.CodeRelationshipRepo;
import com.sensei.repository.RepositoryRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Executor;

/**
 * Async ingestion pipeline: clone → walk → parse → persist → index.
 *
 * <p>Persistence is delegated to a separate transactional bean
 * ({@link IngestionPersistence}) rather than a {@code @Transactional} method on this class.
 * A self-invoked {@code @Transactional} method bypasses the Spring proxy entirely, which is
 * the classic reason bulk saves silently run without a transaction.
 */
@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);

    /**
     * Directories that never contain first-party source worth indexing. Skipping these is the
     * single largest performance win on the walk: a typical Node project is >90% node_modules
     * by file count, and walking it makes ingestion take minutes instead of seconds.
     */
    private static final Set<String> SKIPPED_DIRECTORIES = Set.of(
            ".git", ".github", ".idea", ".vscode", ".mvn", ".gradle",
            "node_modules", "bower_components", "vendor",
            "target", "build", "dist", "out", "bin", "obj",
            ".venv", "venv", "env", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
            "coverage", ".nyc_output", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache",
            "logs", "tmp", "temp", ".terraform"
    );

    /** Filenames with no extension-signal we still want to skip outright. */
    private static final Set<String> SKIPPED_FILES = Set.of(
            "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "uv.lock", "Cargo.lock"
    );

    /** Guard against pathological single files (generated bundles, minified assets). */
    private static final long MAX_FILE_BYTES = 1_000_000L;

    private final RepositoryRepo repositoryRepo;
    private final GitCloneService gitCloneService;
    private final IngestionPersistence persistence;
    private final List<LanguageAnalyzer> analyzers;
    private final AiServiceClient aiServiceClient;
    private final Executor ingestionExecutor;

    public IngestionService(RepositoryRepo repositoryRepo,
                            GitCloneService gitCloneService,
                            IngestionPersistence persistence,
                            List<LanguageAnalyzer> analyzers,
                            AiServiceClient aiServiceClient,
                            @Qualifier("ingestionExecutor") Executor ingestionExecutor) {
        this.repositoryRepo = repositoryRepo;
        this.gitCloneService = gitCloneService;
        this.persistence = persistence;
        this.analyzers = analyzers;
        this.aiServiceClient = aiServiceClient;
        this.ingestionExecutor = ingestionExecutor;
    }

    /**
     * Kick off ingestion on the dedicated executor.
     *
     * <p>Note this method is intentionally <em>not</em> evaluated on the caller's thread: it
     * immediately hands off to the pool so the HTTP request that submitted the repository
     * returns in milliseconds with a QUEUED status.
     */
    @Async("ingestionExecutor")
    public void ingestAsync(Long repoId) {
        ingest(repoId);
    }

    /** Synchronous pipeline body — also callable directly from tests. */
    public void ingest(Long repoId) {
        RepositoryEntity repo = repositoryRepo.findById(repoId).orElse(null);
        if (repo == null) {
            log.warn("Ingestion requested for unknown repo {}", repoId);
            return;
        }

        try {
            // ── Step 1: clone ────────────────────────────────────────────────
            updateStatus(repo, RepoStatus.CLONING);

            String branch = repo.getDefaultBranch();
            if (branch == null || branch.isBlank()) {
                branch = gitCloneService.detectDefaultBranch(repo.getGithubUrl());
                repo.setDefaultBranch(branch);
            }
            String clonePath = gitCloneService.cloneRepository(repo.getGithubUrl(), branch);

            // ── Step 2: parse ────────────────────────────────────────────────
            repo.setClonePath(clonePath);
            updateStatus(repo, RepoStatus.PARSING);

            AnalysisResult analysis = new AnalysisResult();
            Path root = Path.of(clonePath);
            walkAndAnalyze(repoId, root, analysis);

            log.info("Parsed repo {}: {} files, {} entities, {} relationships, {} chunks",
                    repoId, analysis.files.size(), analysis.entities.size(),
                    analysis.relationships.size(), analysis.chunks.size());

            persistence.saveAll(repoId, analysis);

            repo.setTotalFiles(analysis.files.size());
            repo.setTotalClasses(analysis.entities.size());
            repo.setTotalMethods((int) analysis.chunks.stream()
                    .filter(c -> "METHOD".equals(c.getChunkType())).count());
            repo.setTotalRelationships(analysis.relationships.size());

            // ── Step 3: index into the vector store ──────────────────────────
            updateStatus(repo, RepoStatus.INDEXING);
            aiServiceClient.indexChunks(repoId, analysis.chunks);

            updateStatus(repo, RepoStatus.READY);
            log.info("Repository {} ingestion complete", repo.getName());

        } catch (Exception e) {
            log.error("Ingestion failed for repo {}", repoId, e);
            // Re-read so we persist onto a fresh managed instance rather than a detached one.
            repositoryRepo.findById(repoId).ifPresent(fresh -> {
                fresh.setStatus(RepoStatus.FAILED);
                fresh.setErrorMessage(truncate(e.getMessage(), 900));
                repositoryRepo.save(fresh);
            });
        }
    }

    /**
     * Walk the clone, skipping vendor/build directories, and hand each supported file to the
     * first analyzer that claims it.
     */
    private void walkAndAnalyze(Long repoId, Path root, AnalysisResult analysis) {
        int[] fileCount = {0};

        try {
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    if (!dir.equals(root) && SKIPPED_DIRECTORIES.contains(dir.getFileName().toString())) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (!attrs.isRegularFile() || isSkippable(file, attrs)) {
                        return FileVisitResult.CONTINUE;
                    }
                    String fileName = file.getFileName().toString();
                    for (LanguageAnalyzer analyzer : analyzers) {
                        if (analyzer.supports(fileName)) {
                            analyzer.analyzeFile(repoId, file, root, analysis);
                            fileCount[0]++;
                            break;
                        }
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    // Unreadable symlinks / permission errors should not abort the whole walk.
                    log.debug("Skipping unreadable path {}: {}", file, exc.getMessage());
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            log.error("Directory walk failed for {}: {}", root, e.getMessage());
        }

        log.info("Analyzed {} supported files under {}", fileCount[0], root);
    }

    private boolean isSkippable(Path file, BasicFileAttributes attrs) {
        String name = file.getFileName().toString();
        if (SKIPPED_FILES.contains(name) || name.endsWith(".min.js") || name.endsWith(".min.css")) {
            return true;
        }
        return attrs.size() > MAX_FILE_BYTES;
    }

    private void updateStatus(RepositoryEntity repo, RepoStatus status) {
        repo.setStatus(status);
        repositoryRepo.save(repo);
    }

    private String truncate(String value, int max) {
        if (value == null) return "Unknown error";
        return value.length() <= max ? value : value.substring(0, max) + "…";
    }
}
