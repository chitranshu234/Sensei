package com.codeintel.controller;

import com.codeintel.dto.ChatRequest;
import com.codeintel.service.AiServiceClient;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Map;

@RestController
@RequestMapping("/api/repositories/{repoId}")
public class ChatController {

    private final AiServiceClient aiServiceClient;

    public ChatController(AiServiceClient aiServiceClient) {
        this.aiServiceClient = aiServiceClient;
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chat(@PathVariable Long repoId,
                             @Valid @RequestBody ChatRequest request) {
        return aiServiceClient.chat(repoId, request.getMessage(), request.getSessionId());
    }

    @PostMapping("/onboarding")
    public ResponseEntity<Map<String, Object>> generateOnboarding(@PathVariable Long repoId) {
        Map<String, Object> guide = aiServiceClient.generateOnboarding(repoId);
        return ResponseEntity.ok(guide);
    }
}
