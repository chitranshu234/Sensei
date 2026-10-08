package com.codeintel.controller;

import com.codeintel.entity.CodeChunkEntity;
import com.codeintel.entity.CodeFileEntity;
import com.codeintel.repository.CodeChunkRepo;
import com.codeintel.repository.CodeFileRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/repositories/{repoId}")
public class AnalysisController {

    private final CodeFileRepo codeFileRepo;
    private final CodeChunkRepo codeChunkRepo;
    private final com.codeintel.repository.RepositoryRepo repositoryRepo;

    public AnalysisController(CodeFileRepo codeFileRepo,
                              CodeChunkRepo codeChunkRepo,
                              com.codeintel.repository.RepositoryRepo repositoryRepo) {
        this.codeFileRepo = codeFileRepo;
        this.codeChunkRepo = codeChunkRepo;
        this.repositoryRepo = repositoryRepo;
    }

    @GetMapping("/files")
    public ResponseEntity<List<CodeFileEntity>> getFiles(@PathVariable Long repoId) {
        return ResponseEntity.ok(codeFileRepo.findByRepoId(repoId));
    }

    @GetMapping("/files/content")
    public ResponseEntity<Map<String, Object>> getFileContent(
            @PathVariable Long repoId,
            @RequestParam String filePath) {
        var repo = repositoryRepo.findById(repoId)
                .orElseThrow(() -> new RuntimeException("Repository not found"));

        Map<String, Object> result = new HashMap<>();
        result.put("filePath", filePath);

        try {
            Path basePath = Path.of(repo.getClonePath()).normalize().toAbsolutePath();
            Path fullPath = basePath.resolve(filePath).normalize().toAbsolutePath();

            if (!fullPath.startsWith(basePath)) {
                throw new SecurityException("Invalid file path: Directory traversal detected");
            }

            if (Files.exists(fullPath)) {
                result.put("content", Files.readString(fullPath));
                result.put("lineCount", (int) Files.lines(fullPath).count());
            } else {
                result.put("content", "// File not found: " + filePath);
                result.put("lineCount", 0);
            }
        } catch (IOException | SecurityException e) {
            result.put("content", "// Error reading file: " + e.getMessage());
            result.put("lineCount", 0);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/chunks")
    public ResponseEntity<List<CodeChunkEntity>> getChunks(@PathVariable Long repoId) {
        return ResponseEntity.ok(codeChunkRepo.findByRepoId(repoId));
    }

    @GetMapping("/search")
    public ResponseEntity<List<CodeChunkEntity>> searchCode(
            @PathVariable Long repoId,
            @RequestParam String query) {
        return ResponseEntity.ok(codeChunkRepo.searchByKeyword(repoId, query));
    }
}
