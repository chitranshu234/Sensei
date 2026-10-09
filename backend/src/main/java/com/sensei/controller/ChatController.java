package com.sensei.controller;

import com.sensei.dto.ChatRequest;
import com.sensei.service.AiServiceClient;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Streaming chat + onboarding endpoints.
 *
 * <p>The chat endpoint streams the AI service's answer to the browser token-by-token with a
 * {@link ResponseBodyEmitter}, writing each chunk as raw UTF-8 text as it arrives.
 *
 * <p>We deliberately do <b>not</b> use Spring's {@code text/event-stream} + {@code Flux<String>}
 * path. That path wraps every emitted element in its own {@code data:} SSE field; combined with any
 * manual framing it produces <em>double</em>-encoded SSE, so the client renders a literal
 * {@code data:} prefix on every line and block markdown (headings, lists) breaks. Streaming plain
 * text and letting the client append it verbatim keeps the markdown exactly as the model wrote it.
 */
@RestController
@RequestMapping("/api/repositories/{repoId}")
public class ChatController {

    private final AiServiceClient aiServiceClient;

    public ChatController(AiServiceClient aiServiceClient) {
        this.aiServiceClient = aiServiceClient;
    }

    @PostMapping(value = "/chat", produces = "text/plain;charset=UTF-8")
    public ResponseBodyEmitter chat(@PathVariable Long repoId,
                                    @Valid @RequestBody ChatRequest request) {
        // Timeout matches spring.mvc.async.request-timeout so long answers aren't cut off.
        ResponseBodyEmitter emitter = new ResponseBodyEmitter(300_000L);
        MediaType utf8Text = new MediaType("text", "plain", StandardCharsets.UTF_8);

        aiServiceClient.chat(repoId, request.getMessage(), request.getSessionId())
                .subscribe(
                        token -> {
                            try {
                                emitter.send(token, utf8Text);
                            } catch (IOException e) {
                                // Client disconnected mid-stream — stop cleanly.
                                emitter.completeWithError(e);
                            }
                        },
                        emitter::completeWithError,
                        emitter::complete
                );

        return emitter;
    }

    @PostMapping("/onboarding")
    public ResponseEntity<Map<String, Object>> generateOnboarding(@PathVariable Long repoId) {
        return ResponseEntity.ok(aiServiceClient.generateOnboarding(repoId));
    }
}
