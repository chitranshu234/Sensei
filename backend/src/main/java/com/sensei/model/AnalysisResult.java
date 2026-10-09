package com.sensei.model;

import com.sensei.entity.CodeChunkEntity;
import com.sensei.entity.CodeEntity;
import com.sensei.entity.CodeFileEntity;
import com.sensei.entity.CodeRelationshipEntity;

import java.util.ArrayList;
import java.util.List;

public class AnalysisResult {
    public List<CodeFileEntity> files = new ArrayList<>();
    public List<CodeEntity> entities = new ArrayList<>();
    public List<CodeRelationshipEntity> relationships = new ArrayList<>();
    public List<CodeChunkEntity> chunks = new ArrayList<>();
}
