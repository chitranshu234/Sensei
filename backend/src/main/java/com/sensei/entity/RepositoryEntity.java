package com.sensei.entity;

import com.sensei.model.RepoStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "repositories")
public class RepositoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String githubUrl;

    private String defaultBranch;

    private String clonePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RepoStatus status = RepoStatus.QUEUED;

    private String errorMessage;

    // Stats
    private Integer totalFiles;
    private Integer totalClasses;
    private Integer totalMethods;
    private Integer totalRelationships;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // -- Getters and Setters --

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }

    public String getDefaultBranch() { return defaultBranch; }
    public void setDefaultBranch(String defaultBranch) { this.defaultBranch = defaultBranch; }

    public String getClonePath() { return clonePath; }
    public void setClonePath(String clonePath) { this.clonePath = clonePath; }

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
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
}
