import { clearSession, readToken } from '../utils/tokenStorage';
import type {
  AuthSession,
  LoginPayload,
  RegisterPayload,
} from '../types/auth';

const BASE_URL = '/api';

/** Structured error carrying the HTTP status, so callers can branch on 401 vs 404 vs 500. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fired when the server rejects our token. The app subscribes to this and signs the user out,
 * which keeps every component from having to handle "session expired" individually.
 */
export const AUTH_EXPIRED_EVENT = 'codeintel:auth-expired';

function authHeaders(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function toError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed';
  try {
    const body = await response.json();
    if (body?.message) message = body.message;
  } catch {
    // Non-JSON body (proxy error page, empty response) — the status text stands in.
  }
  return new ApiError(response.status, message);
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }
  if (!response.ok) {
    throw await toError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Consume a Server-Sent Events stream from a POST.
 *
 * <p>{@code EventSource} cannot be used here because it only issues GET requests and cannot send
 * a JSON body or an Authorization header. So the stream is read manually and parsed to the SSE
 * spec: consecutive {@code data:} lines are one payload rejoined with newlines. That detail is
 * what keeps markdown code fences and paragraph breaks intact — splitting on every newline would
 * shred the model's formatting. Line fragments are held in a buffer until a blank line signals a
 * complete frame, because a chunk boundary can land mid-line.
 */
export async function streamChat(
  repoId: number,
  message: string,
  handlers: {
    onToken: (token: string) => void;
    onDone?: () => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${BASE_URL}/repositories/${repoId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ repoId, message }),
    signal,
  });

  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    handlers.onError?.('Your session has expired. Please sign in again.');
    return;
  }
  if (!response.ok || !response.body) {
    const error = await toError(response);
    handlers.onError?.(error.message);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line.
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');

        const eventName = frame
          .split('\n')
          .filter((line) => line.startsWith('event:'))
          .map((line) => line.slice(6).trim())[0];

        const dataLines = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => (line.startsWith('data: ') ? line.slice(6) : line.slice(5)));

        if (dataLines.length === 0) continue;

        // Per the SSE spec each `data:` line is one line of the payload.
        const payload = dataLines.join('\n');

        if (eventName === 'done' || payload === '[DONE]') {
          finished = true;
          handlers.onDone?.();
          break;
        }
        handlers.onToken(payload);
      }
    }
  } finally {
    reader.cancel().catch(() => {
      // The stream is already closed; nothing further to release.
    });
  }
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register: (payload: RegisterPayload) =>
    request<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => request<AuthSession>('/auth/me'),

  // ── Repositories ──────────────────────────────────────────────────────────
  submitRepository: (githubUrl: string, branch?: string) =>
    request('/repositories', {
      method: 'POST',
      body: JSON.stringify({ githubUrl, branch }),
    }),

  getRepositories: () => request('/repositories'),

  getRepository: (id: number) => request(`/repositories/${id}`),

  deleteRepository: (id: number) =>
    request<void>(`/repositories/${id}`, { method: 'DELETE' }),

  // ── Architecture ──────────────────────────────────────────────────────────
  getArchitecture: (repoId: number) => request(`/repositories/${repoId}/architecture`),

  getSpringLayers: (repoId: number) =>
    request(`/repositories/${repoId}/architecture/spring-layers`),

  // ── Code ──────────────────────────────────────────────────────────────────
  getFiles: (repoId: number) => request(`/repositories/${repoId}/files`),

  getFileContent: (repoId: number, filePath: string) =>
    request(`/repositories/${repoId}/files/content?filePath=${encodeURIComponent(filePath)}`),

  getEntities: (repoId: number) => request(`/repositories/${repoId}/entities`),

  getRelationships: (repoId: number) => request(`/repositories/${repoId}/relationships`),

  getChunks: (repoId: number) => request(`/repositories/${repoId}/chunks`),

  searchCode: (repoId: number, query: string) =>
    request(`/repositories/${repoId}/search?query=${encodeURIComponent(query)}`),

  // ── AI ────────────────────────────────────────────────────────────────────
  streamChat,
  generateOnboarding: (repoId: number) =>
    request(`/repositories/${repoId}/onboarding`, { method: 'POST' }),
};
