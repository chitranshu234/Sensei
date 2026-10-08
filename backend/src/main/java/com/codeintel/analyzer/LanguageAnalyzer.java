package com.codeintel.analyzer;

import com.codeintel.model.AnalysisResult;
import java.nio.file.Path;

public interface LanguageAnalyzer {
    boolean supports(String fileName);
    void analyzeFile(Long repoId, Path file, Path root, AnalysisResult result);
}
