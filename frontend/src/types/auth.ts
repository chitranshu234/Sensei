/** Shapes mirroring the backend auth DTOs. */

export interface AuthUser {
  userId: number;
  username: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthSession extends AuthUser {
  token: string;
  expiresInSeconds: number;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  displayName?: string;
}
