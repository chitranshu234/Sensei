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

    private static final Pattern CLASS_PATTERN = Pattern.compile("^\\s*class\\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\\s*\\(([^)]*)\\))?\\s*:", Pattern.MULTILINE);
    private static final Pattern FUNC_PATTERN = Pattern.compile("^\\s*(?:async\\s+)?def\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(", Pattern.MULTILINE);
    private static final Pattern IMPORT_PATTERN = Pattern.compile("^\\s*import\\s+([a-zA-Z0-9_\\.]+)", Pattern.MULTILINE);
    private static final Pattern FROM_IMPORT_PATTERN = Pattern.compile("^\\s*from\\s+([a-zA-Z0-9_\\.]+)\\s+import\\s+([^#\\n]+)", Pattern.MULTILINE);

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
        String normalized = fileName.replace('\\', '/').toLowerCase();
        if (!normalized.endsWith(".py")) {
            return false;
        }
        String[] parts = normalized.split("/");
        String lastPart = parts[parts.length - 1];
        if (lastPart.startsWith("test_") || lastPart.endsWith("_test.py") || lastPart.equals("conftest.py")) {
            return false;
        }
        for (int i = 0; i < parts.length - 1; i++) {
            if (parts[i].equals("tests") || parts[i].equals("test")) {
                return false;
            }
        }
        return true;
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

            // Import statements (import foo or import foo.bar)
            Matcher importMatcher = IMPORT_PATTERN.matcher(source);
            while (importMatcher.find()) {
                String rawMod = importMatcher.group(1);
                String modBase = rawMod.contains(".") ? rawMod.substring(rawMod.lastIndexOf('.') + 1) : rawMod;
                if (!modBase.isEmpty() && !modBase.equals(baseSourceName)) {
                    CodeRelationshipEntity rel = new CodeRelationshipEntity();
                    rel.setRepoId(repoId);
                    rel.setSourceName(baseSourceName);
                    rel.setTargetName(modBase);
                    rel.setRelationType(RelationType.CALLS);
                    rel.setDescription(baseSourceName + " imports " + modBase);
                    result.relationships.add(rel);
                }
            }

            // From import statements (from foo.bar import Baz, Quux)
            Matcher fromImportMatcher = FROM_IMPORT_PATTERN.matcher(source);
            while (fromImportMatcher.find()) {
                String rawModule = fromImportMatcher.group(1).trim();
                String rawItems = fromImportMatcher.group(2).trim();

                String modBase = rawModule.contains(".") ? rawModule.substring(rawModule.lastIndexOf('.') + 1) : rawModule;
                if (!modBase.isEmpty() && !modBase.equals(".") && !modBase.equals(baseSourceName)) {
                    CodeRelationshipEntity rel = new CodeRelationshipEntity();
                    rel.setRepoId(repoId);
                    rel.setSourceName(baseSourceName);
                    rel.setTargetName(modBase);
                    rel.setRelationType(RelationType.CALLS);
                    rel.setDescription(baseSourceName + " imports module " + modBase);
                    result.relationships.add(rel);
                }

                String cleanItems = rawItems.replaceAll("[()]", "");
                for (String item : cleanItems.split(",")) {
                    String cleanItem = item.trim();
                    if (cleanItem.contains(" as ")) {
                        cleanItem = cleanItem.substring(0, cleanItem.indexOf(" as ")).trim();
                    }
                    if (!cleanItem.isEmpty() && Character.isUpperCase(cleanItem.charAt(0))) {
                        CodeRelationshipEntity rel = new CodeRelationshipEntity();
                        rel.setRepoId(repoId);
                        rel.setSourceName(baseSourceName);
                        rel.setTargetName(cleanItem);
                        rel.setRelationType(RelationType.CALLS);
                        rel.setDescription(baseSourceName + " imports " + cleanItem);
                        result.relationships.add(rel);
                    }
                }
            }

            // Class definitions and inheritance
            Matcher classMatcher = CLASS_PATTERN.matcher(source);
            while (classMatcher.find()) {
                String className = classMatcher.group(1);
                String baseClasses = classMatcher.group(2);

                CodeEntity entity = new CodeEntity();
                entity.setRepoId(repoId);
                entity.setName(className);
                entity.setQualifiedName(relativePath + ":" + className);
                entity.setEntityType(EntityType.CLASS);
                entity.setFilePath(relativePath);
                result.entities.add(entity);

                CodeRelationshipEntity containsRel = new CodeRelationshipEntity();
                containsRel.setRepoId(repoId);
                containsRel.setSourceName(baseSourceName);
                containsRel.setTargetName(entity.getName());
                containsRel.setRelationType(RelationType.CONTAINS);
                containsRel.setDescription(baseSourceName + " contains " + entity.getName());
                result.relationships.add(containsRel);

                // Extract base classes / inheritance
                if (baseClasses != null && !baseClasses.isBlank()) {
                    for (String base : baseClasses.split(",")) {
                        String cleanBase = base.trim();
                        if (cleanBase.contains(".")) {
                            cleanBase = cleanBase.substring(cleanBase.lastIndexOf('.') + 1);
                        }
                        if (!cleanBase.isEmpty() && !cleanBase.equals("object")) {
                            CodeRelationshipEntity extRel = new CodeRelationshipEntity();
                            extRel.setRepoId(repoId);
                            extRel.setSourceName(className);
                            extRel.setTargetName(cleanBase);
                            extRel.setRelationType(RelationType.EXTENDS);
                            extRel.setDescription(className + " extends " + cleanBase);
                            result.relationships.add(extRel);
                        }
                    }
                }
            }

            Matcher funcMatcher = FUNC_PATTERN.matcher(source);
            while (funcMatcher.find()) {
                String name = funcMatcher.group(1);
                CodeChunkEntity methodChunk = new CodeChunkEntity();
                methodChunk.setRepoId(repoId);
                methodChunk.setFilePath(relativePath);
                methodChunk.setEntityName(name);
                methodChunk.setChunkType("METHOD");
                methodChunk.setStartLine(1);
                methodChunk.setEndLine(lines.length);
                methodChunk.setContent("Function: " + name);
                methodChunk.setSummary("Python function: " + name);
                result.chunks.add(methodChunk);
            }

        } catch (IOException e) {
            log.warn("Error reading Python {}: {}", file, e.getMessage());
        }
    }
}
