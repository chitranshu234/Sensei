package com.codeintel.controller;

import com.codeintel.dto.RepositoryRequest;
import com.codeintel.dto.RepositoryResponse;
import com.codeintel.service.RepositoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/repositories")
public class RepositoryController {

    private final RepositoryService repositoryService;

    public RepositoryController(RepositoryService repositoryService) {
        this.repositoryService = repositoryService;
    }

    @PostMapping
    public ResponseEntity<RepositoryResponse> submitRepository(@Valid @RequestBody RepositoryRequest request) {
        RepositoryResponse response = repositoryService.submitRepository(
                request.getGithubUrl(), request.getBranch());
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<RepositoryResponse>> getAllRepositories() {
        return ResponseEntity.ok(repositoryService.getAllRepositories());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RepositoryResponse> getRepository(@PathVariable Long id) {
        return ResponseEntity.ok(repositoryService.getRepository(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRepository(@PathVariable Long id) {
        repositoryService.deleteRepository(id);
        return ResponseEntity.noContent().build();
    }
}
