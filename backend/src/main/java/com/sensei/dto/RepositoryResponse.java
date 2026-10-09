package com.sensei.dto;

import com.sensei.model.RepoStatus;
import java.time.LocalDateTime;

public class RepositoryResponse {
    private Long id;
    private String name;
    private String githubUrl;
    private String defaultBranch;
    private RepoStatus status;
    private String errorMessage;
    private Integer totalFiles;
    private Integer totalClasses;
    private Integer totalMethods;
    private Integer totalRelationships;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // -- Getters and Setters --

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }

    public String getDefaultBranch() { return defaultBranch; }
    public void setDefaultBranch(String defaultBranch) { this.defaultBranch = defaultBranch; }

    public RepoStatus getStatus() { return status; }
    public void setStatus(RepoStatus status) { this.status = status; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Integer getTotalFiles() { return totalFiles; }
    public void setTotalFiles(Integer totalFiles) { this.totalFiles = totalFiles; }

    public Integer getTotalClasses() { return totalClasses; }
    public void setTotalClasses(Integer totalClasses) { this.totalClasses = totalClasses; }

    public Integer getTotalMethods() { return totalMethods; }
    public void setTotalMethods(Integer totalMethods) { this.totalMethods = totalMethods; }

    public Integer getTotalRelationships() { return totalRelationships; }
    public void setTotalRelationships(Integer totalRelationships) { this.totalRelationships = totalRelationships; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    // -- Static factory --
    public static RepositoryResponse from(com.sensei.entity.RepositoryEntity entity) {
        RepositoryResponse dto = new RepositoryResponse();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setGithubUrl(entity.getGithubUrl());
        dto.setDefaultBranch(entity.getDefaultBranch());
        dto.setStatus(entity.getStatus());
        dto.setErrorMessage(entity.getErrorMessage());
        dto.setTotalFiles(entity.getTotalFiles());
        dto.setTotalClasses(entity.getTotalClasses());
        dto.setTotalMethods(entity.getTotalMethods());
        dto.setTotalRelationships(entity.getTotalRelationships());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }
}
