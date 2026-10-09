package com.codeintel.controller;

import com.codeintel.dto.ChatRequest;
import com.codeintel.service.AiServiceClient;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Map;

/**
 * Streaming chat + onboarding guide endpoints.
 *
 * <p>The browser consumes the chat endpoint with {@code fetch()} and a stream reader rather
 * than {@code EventSource} (EventSource cannot send a JSON POST body). Every token is emitted
 * as a spec-compliant Server-Sent Event frame, with newlines inside a token split across
 * multiple {@code data:} lines — which the SSE spec defines as a single payload rejoined with
 * newlines. That keeps markdown code fences and line breaks intact on the client.
 *
 * <p>A terminal {@code event: done} frame lets the client finish cleanly instead of inferring
 * completion from connection teardown.
 */
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
        return aiServiceClient.chat(repoId, request.getMessage(), request.getSessionId())
                .map(this::toSseFrame)
                .concatWith(Flux.just("event: done\ndata: [DONE]\n\n"))
                .onErrorResume(e -> Flux.just(
                        toSseFrame("⚠️ The AI stream ended unexpectedly. Please retry."),
                        "event: done\ndata: [DONE]\n\n"));
    }

    @PostMapping("/onboarding")
    public ResponseEntity<Map<String, Object>> generateOnboarding(@PathVariable Long repoId) {
        return ResponseEntity.ok(aiServiceClient.generateOnboarding(repoId));
    }

    /**
     * Wrap a raw token in an SSE frame. One {@code data:} line per source line, so the
     * client can rejoin them with {@code \n} exactly as the SSE spec prescribes.
     */
    private String toSseFrame(String token) {
        if (token == null || token.isEmpty()) {
            return "data: \n\n";
        }
        String normalized = token.replace("\r\n", "\n").replace('\r', '\n');
        StringBuilder frame = new StringBuilder();
        String[] lines = normalized.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            if (i == lines.length - 1 && lines[i].isEmpty()) {
                break; // trailing newline is represented by the frame terminator itself
            }
            frame.append("data: ").append(lines[i]).append('\n');
        }
        return frame.append('\n').toString();
    }
}
