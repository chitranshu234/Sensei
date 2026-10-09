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
 * A regex-based heuristics parser for C/C++.
 * Extracts functions, structs/classes, and includes.
 */
@Component
public class CCodeAnalyzer implements LanguageAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(CCodeAnalyzer.class);

    private static final Pattern CLASS_PATTERN = Pattern.compile("^[\\s]*(?:struct|class)\\s+([a-zA-Z_][a-zA-Z0-9_]*)", Pattern.MULTILINE);
    private static final Pattern FUNC_PATTERN = Pattern.compile("^[\\s]*(?:[a-zA-Z_][a-zA-Z0-9_]*\\s+)+\\*?\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\([^)]*\\)\\s*\\{", Pattern.MULTILINE);
    private static final Pattern INCLUDE_PATTERN = Pattern.compile("^\\s*#include\\s*[<\"]([^>\"]+)[>\"]", Pattern.MULTILINE);

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
        return fileName.endsWith(".c") || fileName.endsWith(".cpp") || fileName.endsWith(".h") || fileName.endsWith(".hpp");
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
            fileEntity.setLanguage(fileNameToLanguage(file.getFileName().toString()));
            result.files.add(fileEntity);

            CodeChunkEntity fileChunk = new CodeChunkEntity();
            fileChunk.setRepoId(repoId);
            fileChunk.setFilePath(relativePath);
            fileChunk.setEntityName(file.getFileName().toString());
            fileChunk.setChunkType("FILE");
            fileChunk.setStartLine(1);
            fileChunk.setEndLine(lines.length);
            fileChunk.setContent(source);
            fileChunk.setSummary("C/C++ file: " + relativePath);
            result.chunks.add(fileChunk);

            String baseSourceName = extractBaseName(file.getFileName().toString());
            CodeEntity moduleEntity = new CodeEntity();
            moduleEntity.setRepoId(repoId);
            moduleEntity.setName(baseSourceName);
            moduleEntity.setQualifiedName(relativePath);
            moduleEntity.setEntityType(EntityType.COMPONENT);
            moduleEntity.setFilePath(relativePath);
            result.entities.add(moduleEntity);

            Matcher includeMatcher = INCLUDE_PATTERN.matcher(source);
            while (includeMatcher.find()) {
                String includedFile = includeMatcher.group(1);
                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(baseSourceName);
                rel.setTargetName(extractBaseName(includedFile));
                rel.setRelationType(RelationType.CALLS);
                rel.setDescription(baseSourceName + " includes " + includedFile);
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

                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(baseSourceName);
                rel.setTargetName(entity.getName());
                rel.setRelationType(RelationType.CONTAINS);
                rel.setDescription(baseSourceName + " contains " + entity.getName());
                result.relationships.add(rel);
            }

            Matcher funcMatcher = FUNC_PATTERN.matcher(source);
            while (funcMatcher.find()) {
                String name = funcMatcher.group(1);
                // skip basic keywords that might match the simple heuristic
                if (name.equals("if") || name.equals("while") || name.equals("for") || name.equals("switch") || name.equals("return")) continue;
                
                CodeChunkEntity methodChunk = new CodeChunkEntity();
                methodChunk.setRepoId(repoId);
                methodChunk.setFilePath(relativePath);
                methodChunk.setEntityName(name);
                methodChunk.setChunkType("METHOD");
                methodChunk.setStartLine(1);
                methodChunk.setEndLine(lines.length);
                methodChunk.setContent("Function: " + name);
                methodChunk.setSummary("C/C++ function: " + name);
                result.chunks.add(methodChunk);
            }

        } catch (IOException e) {
            log.warn("Error reading C/C++ {}: {}", file, e.getMessage());
        }
    }

    private String fileNameToLanguage(String name) {
        if (name.endsWith(".cpp") || name.endsWith(".hpp")) {
            return "cpp";
        }
        return "c";
    }
}
