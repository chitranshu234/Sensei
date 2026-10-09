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
export const AUTH_EXPIRED_EVENT = 'sensei:auth-expired';

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
 * Stream a chat answer from a POST, forwarding each chunk as it arrives.
 *
 * <p>{@code EventSource} cannot be used (it is GET-only and cannot send a JSON body or an
 * Authorization header), so the response body is read manually. The backend streams the answer as
 * plain UTF-8 text, so we simply decode and forward each chunk <em>verbatim</em>. Keeping it raw
 * (rather than re-parsing SSE frames) is what preserves the model's markdown exactly — headings,
 * lists, and fenced code blocks all survive — and avoids the double-`data:`-prefix bug that SSE
 * framing is prone to.
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
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/repositories/${repoId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ repoId, message }),
      signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return;
    handlers.onError?.('Unable to reach the server. Is the backend running?');
    return;
  }

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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) handlers.onToken(text);
    }
    const tail = decoder.decode(); // flush any multi-byte remainder
    if (tail) handlers.onToken(tail);
    handlers.onDone?.();
  } catch (err) {
    if ((err as { name?: string })?.name !== 'AbortError') {
      handlers.onError?.('The connection was interrupted.');
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
