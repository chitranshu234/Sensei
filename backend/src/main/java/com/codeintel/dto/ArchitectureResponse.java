package com.codeintel.dto;

import java.util.List;
import java.util.Map;

public class ArchitectureResponse {
    private List<ArchNode> nodes;
    private List<ArchEdge> edges;

    public ArchitectureResponse() {}
    public ArchitectureResponse(List<ArchNode> nodes, List<ArchEdge> edges) {
        this.nodes = nodes;
        this.edges = edges;
    }

    public List<ArchNode> getNodes() { return nodes; }
    public void setNodes(List<ArchNode> nodes) { this.nodes = nodes; }
    public List<ArchEdge> getEdges() { return edges; }
    public void setEdges(List<ArchEdge> edges) { this.edges = edges; }

    public static class ArchNode {
        private String id;
        private String label;
        private String type;      // CONTROLLER, SERVICE, REPOSITORY, ENTITY, etc.
        private String packageName;
        private String filePath;
        private Map<String, Object> data;

        public ArchNode() {}
        public ArchNode(String id, String label, String type) {
            this.id = id;
            this.label = label;
            this.type = type;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getPackageName() { return packageName; }
        public void setPackageName(String packageName) { this.packageName = packageName; }
        public String getFilePath() { return filePath; }
        public void setFilePath(String filePath) { this.filePath = filePath; }
        public Map<String, Object> getData() { return data; }
        public void setData(Map<String, Object> data) { this.data = data; }
    }

    public static class ArchEdge {
        private String id;
        private String source;
        private String target;
        private String label;
        private String type;      // INJECTS, CALLS, EXTENDS, IMPLEMENTS

        public ArchEdge() {}
        public ArchEdge(String id, String source, String target, String label, String type) {
            this.id = id;
            this.source = source;
            this.target = target;
            this.label = label;
            this.type = type;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public String getTarget() { return target; }
        public void setTarget(String target) { this.target = target; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
    }
}
