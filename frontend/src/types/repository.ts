export type RepoStatus = 'QUEUED' | 'CLONING' | 'PARSING' | 'INDEXING' | 'READY' | 'FAILED';

export interface Repository {
  id: number;
  name: string;
  githubUrl: string;
  defaultBranch: string;
  status: RepoStatus;
  errorMessage?: string;
  totalFiles?: number;
  totalClasses?: number;
  totalMethods?: number;
  totalRelationships?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CodeFile {
  id: number;
  repoId: number;
  filePath: string;
  packageName: string;
  lineCount: number;
  language: string;
}

export interface CodeEntity {
  id: number;
  repoId: number;
  fileId?: number;
  name: string;
  qualifiedName: string;
  entityType: string;
  packageName: string;
  startLine: number;
  endLine: number;
  annotations: string;
  signature?: string;
  filePath: string;
}

export interface CodeRelationship {
  id: number;
  repoId: number;
  sourceEntityId: number;
  targetEntityId: number;
  sourceName: string;
  targetName: string;
  relationType: string;
  description?: string;
}

export interface CodeChunk {
  id: number;
  repoId: number;
  filePath: string;
  entityName: string;
  chunkType: string;
  startLine: number;
  endLine: number;
  content: string;
  summary: string;
}
