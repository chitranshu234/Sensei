const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
}

export const api = {
  // Repositories
  submitRepository: (githubUrl: string, branch?: string) =>
    request('/repositories', {
      method: 'POST',
      body: JSON.stringify({ githubUrl, branch }),
    }),

  getRepositories: () => request('/repositories'),

  getRepository: (id: number) => request(`/repositories/${id}`),

  deleteRepository: (id: number) =>
    fetch(`${BASE_URL}/repositories/${id}`, { method: 'DELETE' }),

  // Architecture
  getArchitecture: (repoId: number) =>
    request(`/repositories/${repoId}/architecture`),

  getSpringLayers: (repoId: number) =>
    request(`/repositories/${repoId}/architecture/spring-layers`),

  // Code
  getFiles: (repoId: number) => request(`/repositories/${repoId}/files`),

  getFileContent: (repoId: number, filePath: string) =>
    request(`/repositories/${repoId}/files/content?filePath=${encodeURIComponent(filePath)}`),

  getEntities: (repoId: number) => request(`/repositories/${repoId}/entities`),

  getRelationships: (repoId: number) =>
    request(`/repositories/${repoId}/relationships`),

  getChunks: (repoId: number) => request(`/repositories/${repoId}/chunks`),

  searchCode: (repoId: number, query: string) =>
    request(`/repositories/${repoId}/search?query=${encodeURIComponent(query)}`),

  // Chat (SSE streaming)
  chatStream: (repoId: number, message: string, sessionId?: string) => {
    return fetch(`${BASE_URL}/repositories/${repoId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoId, message, sessionId }),
    });
  },

  // Onboarding
  generateOnboarding: (repoId: number) =>
    request(`/repositories/${repoId}/onboarding`, { method: 'POST' }),
};
