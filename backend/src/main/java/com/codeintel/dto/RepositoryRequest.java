package com.codeintel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class RepositoryRequest {

    @NotBlank(message = "GitHub URL is required")
    @Pattern(regexp = "^https://github\\.com/[\\w.-]+/[\\w.-]+/?$",
             message = "Must be a valid GitHub repository URL")
    private String githubUrl;

    private String branch;

    public RepositoryRequest() {}

    public RepositoryRequest(String githubUrl) {
        this.githubUrl = githubUrl;
    }

    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
}
