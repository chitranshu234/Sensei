package com.codeintel.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "code_files")
public class CodeFileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long repoId;

    @Column(nullable = false, length = 1000)
    private String filePath;

    private String packageName;

    private Integer lineCount;

    private String language;

    // -- Getters and Setters --

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getPackageName() { return packageName; }
    public void setPackageName(String packageName) { this.packageName = packageName; }

    public Integer getLineCount() { return lineCount; }
    public void setLineCount(Integer lineCount) { this.lineCount = lineCount; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
}
