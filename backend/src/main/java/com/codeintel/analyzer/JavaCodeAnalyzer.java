package com.codeintel.analyzer;

import com.codeintel.entity.CodeChunkEntity;
import com.codeintel.entity.CodeEntity;
import com.codeintel.entity.CodeFileEntity;
import com.codeintel.entity.CodeRelationshipEntity;
import com.codeintel.model.EntityType;
import com.codeintel.model.RelationType;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import com.github.javaparser.ast.nodeTypes.NodeWithAnnotations;
import com.codeintel.model.AnalysisResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Deterministic Java AST analyzer using JavaParser.
 * Extracts classes, interfaces, methods, Spring annotations,
 * and builds injection/call/extension relationships.
 */
@Component
public class JavaCodeAnalyzer implements LanguageAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(JavaCodeAnalyzer.class);

    private static final Set<String> SPRING_CONTROLLER_ANNOTATIONS = Set.of(
            "Controller", "RestController"
    );
    private static final Set<String> SPRING_SERVICE_ANNOTATIONS = Set.of("Service");
    private static final Set<String> SPRING_REPOSITORY_ANNOTATIONS = Set.of("Repository");
    private static final Set<String> SPRING_ENTITY_ANNOTATIONS = Set.of("Entity");
    private static final Set<String> SPRING_COMPONENT_ANNOTATIONS = Set.of("Component");
    private static final Set<String> SPRING_CONFIG_ANNOTATIONS = Set.of("Configuration");

    @Override
    public boolean supports(String fileName) {
        return fileName.endsWith(".java") && !fileName.contains("test");
    }

    @Override
    public void analyzeFile(Long repoId, Path file, Path root, AnalysisResult result) {
        JavaParser parser = new JavaParser();
        Map<String, CodeEntity> entityMap = new HashMap<>();
        
        try {
            String relativePath = root.relativize(file).toString().replace("\\", "/");
            String source = Files.readString(file);
            ParseResult<CompilationUnit> parseResult = parser.parse(source);

            if (!parseResult.isSuccessful() || parseResult.getResult().isEmpty()) {
                log.warn("Failed to parse {}", relativePath);
                return;
            }

            CompilationUnit cu = parseResult.getResult().get();

            // Create file entity
            CodeFileEntity fileEntity = new CodeFileEntity();
            fileEntity.setRepoId(repoId);
            fileEntity.setFilePath(relativePath);
            fileEntity.setPackageName(cu.getPackageDeclaration()
                    .map(pd -> pd.getNameAsString()).orElse(""));
            fileEntity.setLineCount((int) source.lines().count());
            fileEntity.setLanguage("java");
            result.files.add(fileEntity);

            String packageName = fileEntity.getPackageName();

            Map<String, String> importMap = new HashMap<>();
            for (com.github.javaparser.ast.ImportDeclaration imp : cu.getImports()) {
                String impName = imp.getNameAsString();
                if (!imp.isAsterisk()) {
                    String shortName = impName.substring(impName.lastIndexOf('.') + 1);
                    importMap.put(shortName, impName);
                }
            }

            // Extract class/interface/enum declarations
            for (TypeDeclaration<?> type : cu.getTypes()) {
                processType(repoId, relativePath, packageName, source, type, result, entityMap, importMap);
            }

        } catch (IOException e) {
            log.warn("Error reading {}: {}", file, e.getMessage());
        }

        buildRelationships(repoId, result, entityMap);
    }


    private void processType(Long repoId, String filePath, String packageName,
                             String fullSource, TypeDeclaration<?> type,
                             AnalysisResult result, Map<String, CodeEntity> entityMap, Map<String, String> importMap) {

        String name = type.getNameAsString();
        String qualifiedName = packageName.isEmpty() ? name : packageName + "." + name;

        // Determine entity type from Spring annotations
        EntityType entityType = determineEntityType(type);

        // Collect annotation names
        String annotations = type.getAnnotations().stream()
                .map(a -> "@" + a.getNameAsString())
                .collect(Collectors.joining(", "));

        int startLine = type.getBegin().map(p -> p.line).orElse(0);
        int endLine = type.getEnd().map(p -> p.line).orElse(0);

        CodeEntity entity = new CodeEntity();
        entity.setRepoId(repoId);
        entity.setName(name);
        entity.setQualifiedName(qualifiedName);
        entity.setEntityType(entityType);
        entity.setPackageName(packageName);
        entity.setStartLine(startLine);
        entity.setEndLine(endLine);
        entity.setAnnotations(annotations);
        entity.setFilePath(filePath);
        result.entities.add(entity);

        entityMap.put(name, entity);
        entityMap.put(qualifiedName, entity);

        // Create a class-level code chunk
        CodeChunkEntity classChunk = new CodeChunkEntity();
        classChunk.setRepoId(repoId);
        classChunk.setFilePath(filePath);
        classChunk.setEntityName(name);
        classChunk.setChunkType("CLASS");
        classChunk.setStartLine(startLine);
        classChunk.setEndLine(endLine);
        classChunk.setContent(extractLines(fullSource, startLine, endLine));
        classChunk.setSummary(entityType + " " + name + " in " + packageName);
        result.chunks.add(classChunk);

        // Extract methods and create method-level chunks
        if (type instanceof ClassOrInterfaceDeclaration classDecl) {
            // Track implements/extends
            classDecl.getExtendedTypes().forEach(ext -> {
                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(qualifiedName);
                rel.setTargetName(resolveTypeName(ext.getNameAsString(), packageName, importMap));
                rel.setRelationType(RelationType.EXTENDS);
                result.relationships.add(rel);
            });

            classDecl.getImplementedTypes().forEach(impl -> {
                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(qualifiedName);
                rel.setTargetName(resolveTypeName(impl.getNameAsString(), packageName, importMap));
                rel.setRelationType(RelationType.IMPLEMENTS);
                result.relationships.add(rel);
            });

            // Process methods
            for (MethodDeclaration method : classDecl.getMethods()) {
                int mStart = method.getBegin().map(p -> p.line).orElse(0);
                int mEnd = method.getEnd().map(p -> p.line).orElse(0);

                String methodAnnotations = method.getAnnotations().stream()
                        .map(a -> "@" + a.getNameAsString())
                        .collect(Collectors.joining(", "));

                String signature = method.getDeclarationAsString(true, true, true);

                CodeChunkEntity methodChunk = new CodeChunkEntity();
                methodChunk.setRepoId(repoId);
                methodChunk.setFilePath(filePath);
                methodChunk.setEntityName(name + "." + method.getNameAsString());
                methodChunk.setChunkType("METHOD");
                methodChunk.setStartLine(mStart);
                methodChunk.setEndLine(mEnd);
                methodChunk.setContent(extractLines(fullSource, mStart, mEnd));
                methodChunk.setSummary(
                        (methodAnnotations.isEmpty() ? "" : methodAnnotations + " ") +
                        signature + " in " + name);
                result.chunks.add(methodChunk);

                // Detect method calls for call graph
                method.findAll(MethodCallExpr.class).forEach(call -> {
                    call.getScope().ifPresent(scope -> {
                        if (scope instanceof NameExpr nameExpr) {
                            // field.method() pattern — record as potential CALLS
                            CodeRelationshipEntity rel = new CodeRelationshipEntity();
                            rel.setRepoId(repoId);
                            rel.setSourceName(qualifiedName);
                            rel.setTargetName(resolveTypeName(nameExpr.getNameAsString(), packageName, importMap));
                            rel.setRelationType(RelationType.CALLS);
                            rel.setDescription(name + "." + method.getNameAsString() +
                                    " calls " + nameExpr.getNameAsString() + "." + call.getNameAsString());
                            result.relationships.add(rel);
                        }
                    });
                });
            }

            // Process fields for injection detection
            for (FieldDeclaration field : classDecl.getFields()) {
                boolean isInjected = field.getAnnotations().stream()
                        .anyMatch(a -> a.getNameAsString().equals("Autowired")
                                || a.getNameAsString().equals("Inject"));

                field.getVariables().forEach(var -> {
                    String rawFieldTypeName = var.getType().asString();
                    String fieldTypeName = stripGenerics(rawFieldTypeName);
                    if (isInjected || isConstructorInjected(classDecl, rawFieldTypeName) || isConstructorInjected(classDecl, fieldTypeName)) {
                        CodeRelationshipEntity rel = new CodeRelationshipEntity();
                        rel.setRepoId(repoId);
                        rel.setSourceName(qualifiedName);
                        rel.setTargetName(resolveTypeName(fieldTypeName, packageName, importMap));
                        rel.setRelationType(RelationType.INJECTS);
                        rel.setDescription(name + " injects " + fieldTypeName);
                        result.relationships.add(rel);
                    }
                });
            }
        }
    }

    private boolean isConstructorInjected(ClassOrInterfaceDeclaration classDecl, String typeName) {
        return classDecl.getConstructors().stream()
                .anyMatch(ctor -> ctor.getParameters().stream()
                        .anyMatch(p -> p.getType().asString().equals(typeName) || stripGenerics(p.getType().asString()).equals(typeName)));
    }

    private String stripGenerics(String typeName) {
        if (typeName.contains("<")) {
            String inner = typeName.replaceAll("^[^<]*<([^>]+)>.*$", "$1").trim();
            if (inner.contains(",")) {
                inner = inner.substring(inner.lastIndexOf(",") + 1).trim();
            }
            return inner;
        }
        // Handle array types if any (e.g., UserService[])
        if (typeName.endsWith("[]")) {
            return typeName.replace("[]", "").trim();
        }
        return typeName.trim();
    }

    private String resolveTypeName(String shortName, String packageName, Map<String, String> importMap) {
        if (importMap.containsKey(shortName)) {
            return importMap.get(shortName);
        }
        if (packageName != null && !packageName.isEmpty() && !shortName.contains(".")) {
            return packageName + "." + shortName;
        }
        return shortName;
    }

    /**
     * Resolve relationship source/target IDs from entity map after all entities are parsed.
     */
    private void buildRelationships(Long repoId, AnalysisResult result,
                                    Map<String, CodeEntity> entityMap) {
        // Deduplicate relationships
        Set<String> seen = new HashSet<>();
        List<CodeRelationshipEntity> deduped = new ArrayList<>();

        for (CodeRelationshipEntity rel : result.relationships) {
            String key = rel.getSourceName() + "->" + rel.getTargetName() + ":" + rel.getRelationType();
            if (seen.add(key)) {
                deduped.add(rel);
            }
        }
        result.relationships = deduped;
    }

    private EntityType determineEntityType(TypeDeclaration<?> type) {
        if (!(type instanceof NodeWithAnnotations<?> annotated)) {
            if (type instanceof EnumDeclaration) return EntityType.ENUM;
            if (type instanceof RecordDeclaration) return EntityType.RECORD;
            return EntityType.CLASS;
        }

        Set<String> annNames = type.getAnnotations().stream()
                .map(a -> a.getNameAsString())
                .collect(Collectors.toSet());

        if (annNames.stream().anyMatch(SPRING_CONTROLLER_ANNOTATIONS::contains))
            return EntityType.REST_CONTROLLER;
        if (annNames.stream().anyMatch(SPRING_SERVICE_ANNOTATIONS::contains))
            return EntityType.SERVICE;
        if (annNames.stream().anyMatch(SPRING_REPOSITORY_ANNOTATIONS::contains))
            return EntityType.REPOSITORY;
        if (annNames.stream().anyMatch(SPRING_ENTITY_ANNOTATIONS::contains))
            return EntityType.ENTITY;
        if (annNames.stream().anyMatch(SPRING_CONFIG_ANNOTATIONS::contains))
            return EntityType.CONFIGURATION;
        if (annNames.stream().anyMatch(SPRING_COMPONENT_ANNOTATIONS::contains))
            return EntityType.COMPONENT;

        if (type instanceof ClassOrInterfaceDeclaration cid) {
            if (cid.isInterface()) return EntityType.INTERFACE;
        }
        if (type instanceof EnumDeclaration) return EntityType.ENUM;
        if (type instanceof RecordDeclaration) return EntityType.RECORD;
        if (type instanceof AnnotationDeclaration) return EntityType.ANNOTATION;

        return EntityType.CLASS;
    }

    private String extractLines(String source, int startLine, int endLine) {
        String[] lines = source.split("\n");
        int start = Math.max(0, startLine - 1);
        int end = Math.min(lines.length, endLine);
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < end; i++) {
            sb.append(lines[i]).append("\n");
        }
        return sb.toString();
    }
}
