package com.sensei.controller;

import com.sensei.entity.CodeChunkEntity;
import com.sensei.entity.CodeFileEntity;
import com.sensei.entity.RepositoryEntity;
import com.sensei.exception.BadRequestException;
import com.sensei.exception.ResourceNotFoundException;
import com.sensei.repository.CodeChunkRepo;
import com.sensei.repository.CodeFileRepo;
import com.sensei.repository.RepositoryRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.MalformedInputException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Read endpoints over a repository's parsed artefacts: file tree, file contents,
 * code chunks and keyword search.
 */
@RestController
@RequestMapping("/api/repositories/{repoId}")
public class AnalysisController {

    private static final Logger log = LoggerFactory.getLogger(AnalysisController.class);

    /** Cap on how much source we will return in one response (chars). */
    private static final long MAX_RETURNED_CHARS = 400_000L;

    /** Cap on keyword-search result size so a broad term cannot flood the browser. */
    private static final int MAX_SEARCH_RESULTS = 200;

    private final CodeFileRepo codeFileRepo;
    private final CodeChunkRepo codeChunkRepo;
    private final RepositoryRepo repositoryRepo;

    public AnalysisController(CodeFileRepo codeFileRepo,
                              CodeChunkRepo codeChunkRepo,
                              RepositoryRepo repositoryRepo) {
        this.codeFileRepo = codeFileRepo;
        this.codeChunkRepo = codeChunkRepo;
        this.repositoryRepo = repositoryRepo;
    }

    @GetMapping("/files")
    public ResponseEntity<List<CodeFileEntity>> getFiles(@PathVariable Long repoId) {
        requireRepository(repoId);
        return ResponseEntity.ok(codeFileRepo.findByRepoId(repoId));
    }

    /**
     * Return the contents of a single file inside the cloned repository.
     *
     * <p>The {@code repoId} is looked up first and the requested path is resolved against that
     * repository's clone root, then re-checked with {@code normalize().startsWith(base)}. That
     * check is what stops {@code ../../etc/passwd} from escaping the clone directory — path
     * traversal is the classic vulnerability in any "show me this file" endpoint, and it must be
     * enforced after normalisation, not by string inspection.
     *
     * <p>Reading previously swallowed every failure into the body as a fake file with a comment
     * in it, which made a permission error indistinguishable from real code. Failures now return
     * a proper HTTP status.
     */
    @GetMapping("/files/content")
    public ResponseEntity<Map<String, Object>> getFileContent(@PathVariable Long repoId,
                                                              @RequestParam String filePath) {
        RepositoryEntity repo = requireRepository(repoId);

        if (repo.getClonePath() == null || repo.getClonePath().isBlank()) {
            throw new BadRequestException("This repository has not been cloned yet.");
        }

        Path basePath = Path.of(repo.getClonePath()).normalize().toAbsolutePath();
        Path fullPath = basePath.resolve(filePath).normalize().toAbsolutePath();

        if (!fullPath.startsWith(basePath)) {
            log.warn("Blocked path traversal attempt on repo {}: {}", repoId, filePath);
            throw new BadRequestException("Invalid file path.");
        }
        if (!Files.exists(fullPath)) {
            throw ResourceNotFoundException.repository(repoId);
        }
        if (!Files.isRegularFile(fullPath)) {
            throw new BadRequestException("Path is not a regular file.");
        }

        try {
            if (Files.size(fullPath) > MAX_RETURNED_CHARS) {
                Map<String, Object> result = new HashMap<>();
                result.put("filePath", filePath);
                result.put("content", "// File is too large to display (" + Files.size(fullPath) + " bytes).");
                result.put("lineCount", 0);
                result.put("truncated", true);
                return ResponseEntity.ok(result);
            }

            String content = Files.readString(fullPath, StandardCharsets.UTF_8);
            Map<String, Object> result = new HashMap<>();
            result.put("filePath", filePath);
            result.put("content", content);
            result.put("lineCount", (int) content.lines().count());
            result.put("truncated", false);
            return ResponseEntity.ok(result);

        } catch (MalformedInputException e) {
            // Binary assets (images, jars) are legitimately present in a repo but not text.
            throw new BadRequestException("This file is not readable as UTF-8 text.");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @GetMapping("/chunks")
    public ResponseEntity<List<CodeChunkEntity>> getChunks(@PathVariable Long repoId) {
        requireRepository(repoId);
        return ResponseEntity.ok(codeChunkRepo.findByRepoId(repoId));
    }

    @GetMapping("/search")
    public ResponseEntity<List<CodeChunkEntity>> searchCode(@PathVariable Long repoId,
                                                            @RequestParam String query) {
        requireRepository(repoId);
        if (query == null || query.isBlank()) {
            throw new BadRequestException("Search query must not be empty.");
        }

        List<CodeChunkEntity> matches = codeChunkRepo.searchByKeyword(repoId, query.trim());
        if (matches.size() > MAX_SEARCH_RESULTS) {
            matches = matches.subList(0, MAX_SEARCH_RESULTS);
        }
        return ResponseEntity.ok(matches);
    }

    /** Guard every endpoint on the repository actually existing. */
    private RepositoryEntity requireRepository(Long repoId) {
        return repositoryRepo.findById(repoId)
                .orElseThrow(() -> ResourceNotFoundException.repository(repoId));
    }
}
