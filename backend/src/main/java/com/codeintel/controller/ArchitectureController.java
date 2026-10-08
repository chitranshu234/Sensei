package com.codeintel.controller;

import com.codeintel.dto.ArchitectureResponse;
import com.codeintel.entity.CodeEntity;
import com.codeintel.entity.CodeRelationshipEntity;
import com.codeintel.repository.CodeEntityRepo;
import com.codeintel.repository.CodeRelationshipRepo;
import com.codeintel.service.ArchitectureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/repositories/{repoId}")
public class ArchitectureController {

    private final ArchitectureService architectureService;
    private final CodeEntityRepo codeEntityRepo;
    private final CodeRelationshipRepo codeRelationshipRepo;

    public ArchitectureController(ArchitectureService architectureService,
                                  CodeEntityRepo codeEntityRepo,
                                  CodeRelationshipRepo codeRelationshipRepo) {
        this.architectureService = architectureService;
        this.codeEntityRepo = codeEntityRepo;
        this.codeRelationshipRepo = codeRelationshipRepo;
    }

    @GetMapping("/architecture")
    public ResponseEntity<ArchitectureResponse> getArchitecture(@PathVariable Long repoId) {
        return ResponseEntity.ok(architectureService.getArchitectureGraph(repoId));
    }

    @GetMapping("/architecture/spring-layers")
    public ResponseEntity<ArchitectureResponse> getSpringLayers(@PathVariable Long repoId) {
        return ResponseEntity.ok(architectureService.getSpringLayerGraph(repoId));
    }

    @GetMapping("/entities")
    public ResponseEntity<List<CodeEntity>> getEntities(@PathVariable Long repoId) {
        return ResponseEntity.ok(codeEntityRepo.findByRepoId(repoId));
    }

    @GetMapping("/relationships")
    public ResponseEntity<List<CodeRelationshipEntity>> getRelationships(@PathVariable Long repoId) {
        return ResponseEntity.ok(codeRelationshipRepo.findByRepoId(repoId));
    }
}
