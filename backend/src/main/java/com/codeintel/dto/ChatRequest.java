package com.codeintel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ChatRequest {

    @NotNull(message = "Repository ID is required")
    private Long repoId;

    @NotBlank(message = "Message is required")
    private String message;

    private String sessionId;

    public ChatRequest() {}

    public ChatRequest(Long repoId, String message) {
        this.repoId = repoId;
        this.message = message;
    }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
}
