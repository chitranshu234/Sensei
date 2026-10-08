package com.codeintel.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "code_chunks")
public class CodeChunkEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long repoId;

    @Column(nullable = false, length = 1000)
    private String filePath;

    private String entityName;

    private String chunkType; // CLASS, METHOD, FIELD_GROUP, IMPORT_BLOCK

    private Integer startLine;

    private Integer endLine;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(length = 2000)
    private String summary; // short description for search context

    // -- Getters and Setters --

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getEntityName() { return entityName; }
    public void setEntityName(String entityName) { this.entityName = entityName; }

    public String getChunkType() { return chunkType; }
    public void setChunkType(String chunkType) { this.chunkType = chunkType; }

    public Integer getStartLine() { return startLine; }
    public void setStartLine(Integer startLine) { this.startLine = startLine; }

    public Integer getEndLine() { return endLine; }
    public void setEndLine(Integer endLine) { this.endLine = endLine; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
}
