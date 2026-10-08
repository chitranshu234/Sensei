export interface ArchNode {
  id: string;
  label: string;
  type: string;
  packageName?: string;
  filePath?: string;
  data?: Record<string, unknown>;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

export interface ArchitectureGraph {
  nodes: ArchNode[];
  edges: ArchEdge[];
}
