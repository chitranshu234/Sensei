package com.sensei.analyzer;

import com.sensei.entity.CodeChunkEntity;
import com.sensei.entity.CodeEntity;
import com.sensei.entity.CodeFileEntity;
import com.sensei.entity.CodeRelationshipEntity;
import com.sensei.model.EntityType;
import com.sensei.model.RelationType;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import com.github.javaparser.ast.nodeTypes.NodeWithAnnotations;
import com.sensei.model.AnalysisResult;
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

    /** Path segments that mark generated or test-only sources. */
    private static final Set<String> NON_SOURCE_SEGMENTS = Set.of(
            "test", "tests", "testfixtures", "it", "integrationtest", "generated", "generated-sources"
    );

    /** Standard Java built-in types to avoid recording as architectural components. */
    private static final Set<String> BUILT_IN_TYPES = Set.of(
            "String", "Integer", "Long", "Double", "Float", "Boolean", "Byte", "Short", "Character",
            "Object", "void", "Void", "int", "long", "double", "float", "boolean", "byte", "short", "char",
            "List", "Set", "Map", "Collection", "Optional", "Arrays", "Collections", "Objects",
            "System", "Math", "Thread", "Class", "StringBuilder", "StringBuffer",
            "InputStream", "OutputStream", "Reader", "Writer", "File", "Path", "Paths", "Files",
            "UUID", "Date", "LocalDate", "LocalDateTime", "Instant", "Duration"
    );

    @Override
    public boolean supports(String fileName) {
        String normalized = fileName.replace('\\', '/').toLowerCase();
        if (!normalized.endsWith(".java")) {
            return false;
        }
        // Match whole path segments, not substrings: "LatestService.java" must be accepted
        // even though it contains the letters "test", while "src/test/java/..." is rejected.
        String[] parts = normalized.split("/");
        for (int i = 0; i < parts.length - 1; i++) {
            if (NON_SOURCE_SEGMENTS.contains(parts[i])) {
                return false;
            }
        }
        String lastPart = parts[parts.length - 1];
        if (lastPart.endsWith("test.java") || lastPart.endsWith("tests.java")
                || lastPart.endsWith("testcase.java") || lastPart.endsWith("it.java")) {
            return false;
        }
        return true;
    }

    @Override
    public void analyzeFile(Long repoId, Path file, Path root, AnalysisResult result) {
        JavaParser parser = new JavaParser();
        Map<String, CodeEntity> entityMap = new HashMap<>();
        List<CodeRelationshipEntity> fileRelationships = new ArrayList<>();
        
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
                processType(repoId, relativePath, packageName, source, type, result, entityMap, importMap, fileRelationships);
            }

        } catch (IOException e) {
            log.warn("Error reading {}: {}", file, e.getMessage());
        }

        buildRelationships(repoId, result, fileRelationships, entityMap);
    }


    private void processType(Long repoId, String filePath, String packageName,
                             String fullSource, TypeDeclaration<?> type,
                             AnalysisResult result, Map<String, CodeEntity> entityMap, Map<String, String> importMap,
                             List<CodeRelationshipEntity> fileRelationships) {

        String name = type.getNameAsString();
        String qualifiedName = packageName.isEmpty() ? name : packageName + "." + name;

        // Determine entity type from Spring annotations and structure
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
                String targetType = stripGenerics(ext.getNameAsString());
                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(qualifiedName);
                rel.setTargetName(resolveTypeName(targetType, packageName, importMap));
                rel.setRelationType(RelationType.EXTENDS);
                fileRelationships.add(rel);
            });

            classDecl.getImplementedTypes().forEach(impl -> {
                String targetType = stripGenerics(impl.getNameAsString());
                CodeRelationshipEntity rel = new CodeRelationshipEntity();
                rel.setRepoId(repoId);
                rel.setSourceName(qualifiedName);
                rel.setTargetName(resolveTypeName(targetType, packageName, importMap));
                rel.setRelationType(RelationType.IMPLEMENTS);
                fileRelationships.add(rel);
            });

            // Map field names to their declared types
            Map<String, String> fieldTypeMap = new HashMap<>();
            for (FieldDeclaration field : classDecl.getFields()) {
                field.getVariables().forEach(var -> {
                    String rawFieldTypeName = var.getType().asString();
                    fieldTypeMap.put(var.getNameAsString(), stripGenerics(rawFieldTypeName));
                });
            }
            for (ConstructorDeclaration ctor : classDecl.getConstructors()) {
                for (Parameter p : ctor.getParameters()) {
                    fieldTypeMap.put(p.getNameAsString(), stripGenerics(p.getType().asString()));
                }
            }

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
                        String targetType = null;
                        if (scope instanceof NameExpr nameExpr) {
                            String id = nameExpr.getNameAsString();
                            if (fieldTypeMap.containsKey(id)) {
                                targetType = fieldTypeMap.get(id);
                            } else if (!id.isEmpty() && Character.isUpperCase(id.charAt(0))) {
                                targetType = id;
                            }
                        } else if (scope instanceof FieldAccessExpr fae) {
                            String id = fae.getNameAsString();
                            if (fieldTypeMap.containsKey(id)) {
                                targetType = fieldTypeMap.get(id);
                            }
                        }

                        if (targetType != null && !BUILT_IN_TYPES.contains(targetType)) {
                            CodeRelationshipEntity rel = new CodeRelationshipEntity();
                            rel.setRepoId(repoId);
                            rel.setSourceName(qualifiedName);
                            rel.setTargetName(resolveTypeName(targetType, packageName, importMap));
                            rel.setRelationType(RelationType.CALLS);
                            rel.setDescription(name + "." + method.getNameAsString() +
                                    " calls " + targetType + "." + call.getNameAsString());
                            fileRelationships.add(rel);
                        }
                    });
                });
            }

            // Process fields for injection detection (Autowired, Inject, Lombok, Constructor)
            boolean hasLombokRequiredArgs = type.getAnnotations().stream()
                    .anyMatch(a -> a.getNameAsString().equals("RequiredArgsConstructor"));
            boolean hasLombokAllArgs = type.getAnnotations().stream()
                    .anyMatch(a -> a.getNameAsString().equals("AllArgsConstructor"));
            boolean isSpringComponent = entityType == EntityType.REST_CONTROLLER
                    || entityType == EntityType.CONTROLLER
                    || entityType == EntityType.SERVICE
                    || entityType == EntityType.REPOSITORY
                    || entityType == EntityType.COMPONENT
                    || entityType == EntityType.CONFIGURATION;

            for (FieldDeclaration field : classDecl.getFields()) {
                boolean isExplicitlyInjected = field.getAnnotations().stream()
                        .anyMatch(a -> a.getNameAsString().equals("Autowired")
                                || a.getNameAsString().equals("Inject"));
                boolean isLombokInjected = isSpringComponent && ((hasLombokRequiredArgs && field.isFinal()) || hasLombokAllArgs);

                field.getVariables().forEach(var -> {
                    String rawFieldTypeName = var.getType().asString();
                    String fieldTypeName = stripGenerics(rawFieldTypeName);
                    if (isExplicitlyInjected || isLombokInjected
                            || isConstructorInjected(classDecl, rawFieldTypeName)
                            || isConstructorInjected(classDecl, fieldTypeName)) {
                        if (!BUILT_IN_TYPES.contains(fieldTypeName)) {
                            CodeRelationshipEntity rel = new CodeRelationshipEntity();
                            rel.setRepoId(repoId);
                            rel.setSourceName(qualifiedName);
                            rel.setTargetName(resolveTypeName(fieldTypeName, packageName, importMap));
                            rel.setRelationType(RelationType.INJECTS);
                            rel.setDescription(name + " injects " + fieldTypeName);
                            fileRelationships.add(rel);
                        }
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
     * Deduplicate this file's relationships and opportunistically backfill the numeric
     * source/target entity IDs from the entities resolved within the same file.
     */
    private void buildRelationships(Long repoId, AnalysisResult result,
                                    List<CodeRelationshipEntity> fileRelationships,
                                    Map<String, CodeEntity> entityMap) {
        Set<String> seen = new HashSet<>();
        for (CodeRelationshipEntity existing : result.relationships) {
            seen.add(existing.getSourceName() + "->" + existing.getTargetName() + ":" + existing.getRelationType());
        }

        for (CodeRelationshipEntity rel : fileRelationships) {
            String key = rel.getSourceName() + "->" + rel.getTargetName() + ":" + rel.getRelationType();
            if (!seen.add(key)) {
                continue;
            }
            CodeEntity source = entityMap.get(rel.getSourceName());
            CodeEntity target = entityMap.get(rel.getTargetName());
            if (source != null && source.getId() != null) {
                rel.setSourceEntityId(source.getId());
            }
            if (target != null && target.getId() != null) {
                rel.setTargetEntityId(target.getId());
            }
            result.relationships.add(rel);
        }
    }

    private EntityType determineEntityType(TypeDeclaration<?> type) {
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

        String name = type.getNameAsString();

        if (type instanceof ClassOrInterfaceDeclaration cid) {
            if (cid.isInterface()) {
                boolean extendsRepo = cid.getExtendedTypes().stream().anyMatch(ext -> {
                    String extName = ext.getNameAsString();
                    return extName.endsWith("Repository") || extName.equals("JpaRepository") || extName.equals("CrudRepository");
                });
                if (extendsRepo || name.endsWith("Repository") || name.endsWith("Repo")) {
                    return EntityType.REPOSITORY;
                }
                if (name.endsWith("Service")) {
                    return EntityType.SERVICE;
                }
                return EntityType.INTERFACE;
            }
        }

        if (name.endsWith("Controller")) return EntityType.CONTROLLER;
        if (name.endsWith("Service")) return EntityType.SERVICE;
        if (name.endsWith("Repository") || name.endsWith("Repo")) return EntityType.REPOSITORY;

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
