package com.codeintel.model;

import com.codeintel.entity.CodeChunkEntity;
import com.codeintel.entity.CodeEntity;
import com.codeintel.entity.CodeFileEntity;
import com.codeintel.entity.CodeRelationshipEntity;

import java.util.ArrayList;
import java.util.List;

public class AnalysisResult {
    public List<CodeFileEntity> files = new ArrayList<>();
    public List<CodeEntity> entities = new ArrayList<>();
    public List<CodeRelationshipEntity> relationships = new ArrayList<>();
    public List<CodeChunkEntity> chunks = new ArrayList<>();
}
