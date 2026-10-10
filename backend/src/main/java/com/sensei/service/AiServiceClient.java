package com.sensei.service;

import com.sensei.entity.CodeChunkEntity;
import com.sensei.repository.CodeChunkRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Client for communicating with the Python AI service (FastAPI).
 */
@Service
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);
    private static final Duration INDEX_TIMEOUT = Duration.ofMinutes(15);
    private static final Duration STATUS_TIMEOUT = Duration.ofSeconds(15);
    private static final Duration DELETE_TIMEOUT = Duration.ofSeconds(20);

    private final WebClient aiServiceWebClient;
    private final CodeChunkRepo codeChunkRepo;
    private final ConcurrentHashMap<Long, Object> indexLocks = new ConcurrentHashMap<>();

    public AiServiceClient(WebClient aiServiceWebClient, CodeChunkRepo codeChunkRepo) {
        this.aiServiceWebClient = aiServiceWebClient;
        this.codeChunkRepo = codeChunkRepo;
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

        Map<?, ?> response = aiServiceWebClient.post()
                .uri("/api/ai/index")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(Map.class)
                .block(INDEX_TIMEOUT);

        if (response == null || !(response.get("indexed") instanceof Number indexed)
                || indexed.intValue() != chunks.size()) {
            throw new IllegalStateException("AI service did not confirm the complete repository index");
        }
        log.info("Indexed {} chunks for repo {}", chunks.size(), repoId);
    }



    /**
     * Delete repository code chunks from the AI service.
     */
    public void deleteRepo(Long repoId) {
        try {
            aiServiceWebClient.delete()
                    .uri("/api/ai/index/" + repoId)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block(DELETE_TIMEOUT);
            log.info("Deleted vector store for repo {}", repoId);
        } catch (Exception e) {
            // Chroma is a disposable cache.  The database rows have already been deleted, so a
            // failed remote cleanup must not make a repository appear to remain in the workspace.
            log.warn("AI vector cleanup could not complete for repo {}: {}", repoId, e.getMessage());
        }
    }

    /**
     * Send a chat question to the AI service and get a streaming response.
     */
    public Flux<byte[]> chat(Long repoId, String message, String sessionId) {
        return Mono.fromRunnable(() -> ensureIndexed(repoId))
                // Restoring a missing index embeds every persisted chunk and can take seconds;
                // never hold a servlet request thread while that work is happening.
                .subscribeOn(Schedulers.boundedElastic())
                .thenMany(Flux.defer(() -> streamChat(repoId, message, sessionId)))
                .onErrorResume(e -> {
                    log.error("Could not prepare AI index for repo {}: {}", repoId, e.getMessage());
                    String errorMsg = "I couldn't prepare this repository's AI index. Please try again shortly.";
                    return Flux.just(errorMsg.getBytes(StandardCharsets.UTF_8));
                });
    }

    private Flux<byte[]> streamChat(Long repoId, String message, String sessionId) {
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
                    return Flux.just(errorMsg.getBytes(StandardCharsets.UTF_8));
                });
    }

    /**
     * Make the AI service self-healing after an instance restart or deploy.  Repository chunks
     * are durable in Postgres; Chroma is a local, rebuildable search cache.
     */
    private void ensureIndexed(Long repoId) {
        Object lock = indexLocks.computeIfAbsent(repoId, ignored -> new Object());
        synchronized (lock) {
            try {
                if (hasIndex(repoId)) {
                    return;
                }

                List<CodeChunkEntity> chunks = codeChunkRepo.findByRepoId(repoId);
                if (chunks.isEmpty()) {
                    throw new IllegalStateException("No persisted code chunks are available for this repository");
                }

                log.info("Restoring missing AI index for repo {} from {} persisted chunks", repoId, chunks.size());
                indexChunks(repoId, chunks);
            } finally {
                indexLocks.remove(repoId, lock);
            }
        }
    }

    private boolean hasIndex(Long repoId) {
        Map<?, ?> response = aiServiceWebClient.get()
                .uri("/api/ai/index/{repoId}/status", repoId)
                .retrieve()
                .bodyToMono(Map.class)
                .block(STATUS_TIMEOUT);

        return response != null && response.get("indexed") instanceof Number indexed && indexed.intValue() > 0;
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
