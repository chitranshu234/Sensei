package com.sensei.analyzer;

import com.sensei.entity.CodeChunkEntity;
import com.sensei.entity.CodeEntity;
import com.sensei.entity.CodeFileEntity;
import com.sensei.entity.CodeRelationshipEntity;
import com.sensei.model.AnalysisResult;
import com.sensei.model.EntityType;
import com.sensei.model.RelationType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A regex-based heuristics parser for Python.
 * Extracts functions, classes, and imports.
 */
@Component
public class PythonCodeAnalyzer implements LanguageAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(PythonCodeAnalyzer.class);

    private static final Pattern CLASS_PATTERN = Pattern.compile("^\\s*class\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*[:\\(]", Pattern.MULTILINE);
    private static final Pattern FUNC_PATTERN = Pattern.compile("^\\s*(?:async\\s+)?def\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(", Pattern.MULTILINE);
    private static final Pattern IMPORT_PATTERN = Pattern.compile("^\\s*import\\s+([a-zA-Z0-9_\\.]+)", Pattern.MULTILINE);
    private static final Pattern FROM_IMPORT_PATTERN = Pattern.compile("^\\s*from\\s+([a-zA-Z0-9_\\.]+)\\s+import", Pattern.MULTILINE);

    private String extractBaseName(String path) {
        if (path == null) return "";
        path = path.replaceAll("\\.[a-zA-Z0-9]+$", "");
        int idx = path.lastIndexOf('/');
        if (idx >= 0) {
            return path.substring(idx + 1);
        }
        return path;
    }

    @Override
    public boolean supports(String fileName) {
        return fileName.endsWith(".py");
    }

    @Override
    public void analyzeFile(Long repoId, Path file, Path root, AnalysisResult result) {
        try {
            String relativePath = root.relativize(file).toString().replace("\\", "/");
            String source = Files.readString(file);
            String[] lines = source.split("\n");

            CodeFileEntity fileEntity = new CodeFileEntity();
            fileEntity.setRepoId(repoId);
            fileEntity.setFilePath(relativePath);
            fileEntity.setPackageName("");
            fileEntity.setLineCount(lines.length);
            fileEntity.setLanguage("python");
            result.files.add(fileEntity);

            CodeChunkEntity fileChunk = new CodeChunkEntity();
            fileChunk.setRepoId(repoId);
            fileChunk.setFilePath(relativePath);
            fileChunk.setEntityName(file.getFileName().toString());
            fileChunk.setChunkType("FILE");
            fileChunk.setStartLine(1);
            fileChunk.setEndLine(lines.length);
            fileChunk.setContent(source);
            fileChunk.setSummary("Python file: " + relativePath);
            result.chunks.add(fileChunk);

            String baseSourceName = extractBaseName(file.getFileName().toString());
            CodeEntity moduleEntity = new CodeEntity();
            moduleEntity.setRepoId(repoId);
            moduleEntity.setName(baseSourceName);
            moduleEntity.setQualifiedName(relativePath);
            moduleEntity.setEntityType(EntityType.COMPONENT);
            moduleEntity.setFilePath(relativePath);
            result.entities.add(moduleEntity);

            Matcher importMatcher = IMPORT_PATTERN.matcher(source);
            while (importMatcher.find()) {
                String importedModule = importMatcher.group(1);
                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(baseSourceName);
                rel.setTargetName(importedModule);
                rel.setRelationType(RelationType.CALLS);
                rel.setDescription(baseSourceName + " imports " + importedModule);
                result.relationships.add(rel);
            }

            Matcher fromImportMatcher = FROM_IMPORT_PATTERN.matcher(source);
            while (fromImportMatcher.find()) {
                String importedModule = fromImportMatcher.group(1);
                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(baseSourceName);
                rel.setTargetName(importedModule);
                rel.setRelationType(RelationType.CALLS);
                rel.setDescription(baseSourceName + " imports from " + importedModule);
                result.relationships.add(rel);
            }

            Matcher classMatcher = CLASS_PATTERN.matcher(source);
            while (classMatcher.find()) {
                CodeEntity entity = new CodeEntity();
                entity.setRepoId(repoId);
                entity.setName(classMatcher.group(1));
                entity.setQualifiedName(relativePath + ":" + classMatcher.group(1));
                entity.setEntityType(EntityType.CLASS);
                entity.setFilePath(relativePath);
                result.entities.add(entity);
            }

            Matcher funcMatcher = FUNC_PATTERN.matcher(source);
            while (funcMatcher.find()) {
                String name = funcMatcher.group(1);
                CodeEntity entity = new CodeEntity();
                entity.setRepoId(repoId);
                entity.setName(name);
                entity.setQualifiedName(relativePath + ":" + name);
                entity.setEntityType(EntityType.METHOD);
                entity.setFilePath(relativePath);
                result.entities.add(entity);
            }

        } catch (IOException e) {
            log.warn("Error reading Python {}: {}", file, e.getMessage());
        }
    }
}
