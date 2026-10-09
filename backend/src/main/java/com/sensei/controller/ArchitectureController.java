package com.sensei.controller;

import com.sensei.dto.ArchitectureResponse;
import com.sensei.entity.CodeEntity;
import com.sensei.entity.CodeRelationshipEntity;
import com.sensei.exception.ResourceNotFoundException;
import com.sensei.repository.CodeEntityRepo;
import com.sensei.repository.CodeRelationshipRepo;
import com.sensei.repository.RepositoryRepo;
import com.sensei.service.ArchitectureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Architecture graph endpoints: full graph, Spring-layer view, and raw entities/edges. */
@RestController
@RequestMapping("/api/repositories/{repoId}")
public class ArchitectureController {

    private final ArchitectureService architectureService;
    private final CodeEntityRepo codeEntityRepo;
    private final CodeRelationshipRepo codeRelationshipRepo;
    private final RepositoryRepo repositoryRepo;

    public ArchitectureController(ArchitectureService architectureService,
                                  CodeEntityRepo codeEntityRepo,
                                  CodeRelationshipRepo codeRelationshipRepo,
                                  RepositoryRepo repositoryRepo) {
        this.architectureService = architectureService;
        this.codeEntityRepo = codeEntityRepo;
        this.codeRelationshipRepo = codeRelationshipRepo;
        this.repositoryRepo = repositoryRepo;
    }

    @GetMapping("/architecture")
    public ResponseEntity<ArchitectureResponse> getArchitecture(@PathVariable Long repoId) {
        requireRepository(repoId);
        return ResponseEntity.ok(architectureService.getArchitectureGraph(repoId));
    }

    @GetMapping("/architecture/spring-layers")
    public ResponseEntity<ArchitectureResponse> getSpringLayers(@PathVariable Long repoId) {
        requireRepository(repoId);
        return ResponseEntity.ok(architectureService.getSpringLayerGraph(repoId));
    }

    @GetMapping("/entities")
    public ResponseEntity<List<CodeEntity>> getEntities(@PathVariable Long repoId) {
        requireRepository(repoId);
        return ResponseEntity.ok(codeEntityRepo.findByRepoId(repoId));
    }

    @GetMapping("/relationships")
    public ResponseEntity<List<CodeRelationshipEntity>> getRelationships(@PathVariable Long repoId) {
        requireRepository(repoId);
        return ResponseEntity.ok(codeRelationshipRepo.findByRepoId(repoId));
    }

    private void requireRepository(Long repoId) {
        if (!repositoryRepo.existsById(repoId)) {
            throw ResourceNotFoundException.repository(repoId);
        }
    }
}
