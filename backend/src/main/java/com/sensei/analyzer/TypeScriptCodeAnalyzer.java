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
 * A regex-based heuristics parser for TypeScript/JavaScript/JSX/TSX.
 * Extracts functions, classes, and React components.
 */
@Component
public class TypeScriptCodeAnalyzer implements LanguageAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(TypeScriptCodeAnalyzer.class);

    // Regex to match "export const MyComponent = (props) => {" or "const myFunc = () => {"
    private static final Pattern FUNC_PATTERN = Pattern.compile("(?:export\\s+)?(?:const|let|var|function)\\s+([a-zA-Z0-9_]+)\\s*(?:=|\\()\\s*\\(?[^)]*\\)?\\s*(?:=>|\\{)");
    
    // Regex to match "class MyClass" or "export class MyClass extends Base"
    private static final Pattern CLASS_PATTERN = Pattern.compile("(?:export\\s+)?class\\s+([a-zA-Z0-9_]+)");

    // Regex to match ES6 imports: "import { X } from 'y'" or "import X from 'y'"
    private static final Pattern IMPORT_PATTERN = Pattern.compile("import\\s+(.*?)\\s+from\\s+['\"]([^'\"]+)['\"]");
    
    // Regex to match CommonJS requires: "const x = require('y')"
    private static final Pattern REQUIRE_PATTERN = Pattern.compile("require\\(['\"]([^'\"]+)['\"]\\)");

    private String extractBaseName(String path) {
        if (path == null) return "";
        path = path.replaceAll("\\.[a-zA-Z0-9]+$", "");
        int idx = path.lastIndexOf('/');
        if (idx >= 0) {
            return path.substring(idx + 1);
        }
        return path;
    }

    private String[] parseImportNames(String importClause) {
        String cleanClause = importClause.replaceAll("[{}]", "");
        String[] parts = cleanClause.split(",");
        java.util.List<String> names = new java.util.ArrayList<>();
        for (String p : parts) {
            String name = p.trim();
            if (name.contains(" as ")) {
                name = name.substring(0, name.indexOf(" as ")).trim();
            }
            if (!name.isEmpty() && !name.equals("*") && !name.contains("*")) {
                names.add(name);
            }
        }
        return names.toArray(new String[0]);
    }

    @Override
    public boolean supports(String fileName) {
        return fileName.endsWith(".ts") || fileName.endsWith(".tsx") || 
               fileName.endsWith(".js") || fileName.endsWith(".jsx");
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
            fileEntity.setLanguage("typescript");
            result.files.add(fileEntity);

            // Create a chunk for the entire file (valuable for RAG in JS)
            CodeChunkEntity fileChunk = new CodeChunkEntity();
            fileChunk.setRepoId(repoId);
            fileChunk.setFilePath(relativePath);
            fileChunk.setEntityName(file.getFileName().toString());
            fileChunk.setChunkType("FILE");
            fileChunk.setStartLine(1);
            fileChunk.setEndLine(lines.length);
            fileChunk.setContent(source);
            fileChunk.setSummary("TypeScript/JavaScript file: " + relativePath);
            result.chunks.add(fileChunk);

            // ALWAYS create a CodeEntity for the file (module) itself to guarantee relationships resolve
            String baseSourceName = extractBaseName(file.getFileName().toString());
            CodeEntity moduleEntity = new CodeEntity();
            moduleEntity.setRepoId(repoId);
            moduleEntity.setName(baseSourceName);
            moduleEntity.setQualifiedName(relativePath);
            moduleEntity.setEntityType(EntityType.COMPONENT);
            moduleEntity.setFilePath(relativePath);
            result.entities.add(moduleEntity);

            // Extract imports (dependencies)
            Matcher importMatcher = IMPORT_PATTERN.matcher(source);
            while (importMatcher.find()) {
                String importClause = importMatcher.group(1);
                String[] importedNames = parseImportNames(importClause);
                
                for (String importedName : importedNames) {
                    CodeRelationshipEntity rel = new CodeRelationshipEntity();
                    rel.setRepoId(repoId);
                    rel.setSourceName(baseSourceName);
                    rel.setTargetName(importedName);
                    rel.setRelationType(RelationType.CALLS); 
                    rel.setDescription(baseSourceName + " imports " + importedName);
                    result.relationships.add(rel);
                }
            }

            Matcher requireMatcher = REQUIRE_PATTERN.matcher(source);
            while (requireMatcher.find()) {
                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(baseSourceName);
                rel.setTargetName(extractBaseName(requireMatcher.group(1)));
                rel.setRelationType(RelationType.CALLS);
                rel.setDescription(baseSourceName + " requires " + requireMatcher.group(1));
                result.relationships.add(rel);
            }

            // Extract Classes
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

            // Extract Functions / Arrow Functions
            Matcher funcMatcher = FUNC_PATTERN.matcher(source);
            while (funcMatcher.find()) {
                // Ignore likely keywords or false positives
                String name = funcMatcher.group(1);
                if (name.equals("if") || name.equals("switch") || name.equals("catch") || name.equals("return")) continue;

                CodeChunkEntity chunk = new CodeChunkEntity();
                chunk.setRepoId(repoId);
                chunk.setFilePath(relativePath);
                chunk.setEntityName(name);
                chunk.setChunkType(Character.isUpperCase(name.charAt(0)) ? "COMPONENT" : "METHOD");
                chunk.setStartLine(1);
                chunk.setEndLine(lines.length);
                chunk.setContent("Function/Component: " + name);
                chunk.setSummary("TS/JS function: " + name);
                result.chunks.add(chunk);
            }

        } catch (IOException e) {
            log.warn("Error reading TS/JS {}: {}", file, e.getMessage());
        }
    }
}
