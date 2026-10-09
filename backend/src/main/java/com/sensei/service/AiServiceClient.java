package com.sensei.service;

import com.sensei.entity.CodeChunkEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Client for communicating with the Python AI service (FastAPI).
 */
@Service
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);

    private final WebClient aiServiceWebClient;

    public AiServiceClient(WebClient aiServiceWebClient) {
        this.aiServiceWebClient = aiServiceWebClient;
    }

    /**
     * Send code chunks to the AI service for embedding and indexing.
     */
    public void indexChunks(Long repoId, List<CodeChunkEntity> chunks) {
        List<Map<String, Object>> chunkData = chunks.stream()
                .map(chunk -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("filePath", chunk.getFilePath());
                    map.put("entityName", chunk.getEntityName());
                    map.put("chunkType", chunk.getChunkType());
                    map.put("startLine", chunk.getStartLine());
                    map.put("endLine", chunk.getEndLine());
                    map.put("content", chunk.getContent());
                    map.put("summary", chunk.getSummary());
                    return map;
                })
                .collect(Collectors.toList());

        Map<String, Object> request = new HashMap<>();
        request.put("repoId", repoId);
        request.put("chunks", chunkData);

        try {
            aiServiceWebClient.post()
                    .uri("/api/ai/index")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            log.info("Indexed {} chunks for repo {}", chunks.size(), repoId);
        } catch (Exception e) {
            log.warn("AI service not available for indexing: {}", e.getMessage());
        }
    }

    /**
     * Send a chat question to the AI service and get a streaming response.
     */
    public Flux<byte[]> chat(Long repoId, String message, String sessionId) {
        Map<String, Object> request = new HashMap<>();
        request.put("repoId", repoId);
        request.put("message", message);
        request.put("sessionId", sessionId);

        return aiServiceWebClient.post()
                .uri("/api/ai/chat")
                .bodyValue(request)
                .retrieve()
                .bodyToFlux(org.springframework.core.io.buffer.DataBuffer.class)
                .map(buffer -> {
                    byte[] bytes = new byte[buffer.readableByteCount()];
                    buffer.read(bytes);
                    org.springframework.core.io.buffer.DataBufferUtils.release(buffer);
                    return bytes;
                })
                .onErrorResume(e -> {
                    log.error("AI chat error: {}", e.getMessage());
                    String errorMsg = "{\"error\": \"AI service unavailable: " + e.getMessage() + "\"}";
                    return Flux.just(errorMsg.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                });
    }

    /**
     * Request an onboarding guide from the AI service.
     */
    public Map<String, Object> generateOnboarding(Long repoId) {
        Map<String, Object> request = new HashMap<>();
        request.put("repoId", repoId);

        try {
            return aiServiceWebClient.post()
                    .uri("/api/ai/onboarding")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.error("Onboarding generation failed: {}", e.getMessage());
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("error", "AI service unavailable");
            return fallback;
        }
    }
}
