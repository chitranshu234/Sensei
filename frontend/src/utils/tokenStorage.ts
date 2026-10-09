import type { AuthSession } from '../types/auth';

/**
 * Single source of truth for where the session lives on the client.
 *
 * <p>Tokens are held in localStorage so a refresh does not sign the user out. The trade-off is
 * worth stating plainly: anything in localStorage is readable by any script on the origin, so a
 * successful XSS becomes token theft. The stricter alternative is an httpOnly, Secure,
 * SameSite=Strict cookie that JavaScript cannot read — that is the right choice when a
 * server-rendered auth endpoint is available, and it is what makes CSRF protection necessary
 * again. This client keeps the header-token model because it is a stateless SPA against a
 * stateless API, and it never renders untrusted HTML (React escapes by default).
 */

const TOKEN_KEY = 'sensei.token';
const USER_KEY = 'sensei.user';

export interface StoredUser {
  userId: number;
  username: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
    } satisfies StoredUser)
  );
}

export function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function readUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    // Corrupted entry — clear it rather than crashing the app during boot.
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
