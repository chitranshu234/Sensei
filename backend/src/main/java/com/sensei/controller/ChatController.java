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

import com.sensei.entity.UserEntity;
import com.sensei.repository.UserRepo;
import com.sensei.exception.BadRequestException;
import com.sensei.model.Role;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;

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
    private final UserRepo userRepo;
    private final boolean demoMode;

    public ChatController(AiServiceClient aiServiceClient, 
                          UserRepo userRepo,
                          @Value("${app.demo-mode:false}") boolean demoMode) {
        this.aiServiceClient = aiServiceClient;
        this.userRepo = userRepo;
        this.demoMode = demoMode;
    }

    private UserEntity getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Current user not found"));
    }

    @PostMapping(value = "/chat", produces = "text/plain;charset=UTF-8")
    public ResponseBodyEmitter chat(@PathVariable Long repoId,
                                    @Valid @RequestBody ChatRequest request) {
        if (demoMode) {
            UserEntity user = getCurrentUser();
            if (user.getRole() == Role.USER) {
                if (user.getAiMessageCount() >= 10) {
                    throw new BadRequestException("Demo limit reached: You have asked the maximum of 10 AI questions allowed in this live preview. Please run the project locally for unlimited access!");
                }
                user.setAiMessageCount(user.getAiMessageCount() + 1);
                userRepo.save(user);
            }
        }

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
