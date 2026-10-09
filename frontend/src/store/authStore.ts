import { create } from 'zustand';
import { api, ApiError, AUTH_EXPIRED_EVENT } from '../services/api';
import {
  clearSession,
  readToken,
  readUser,
  saveSession,
  type StoredUser,
} from '../utils/tokenStorage';
import type { LoginPayload, RegisterPayload } from '../types/auth';

interface AuthState {
  user: StoredUser | null;
  /** True until the initial token check finishes, so routes do not flash the login screen. */
  initialising: boolean;
  submitting: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Seed from storage synchronously so a refresh renders the app immediately instead of
  // bouncing through the login page for a frame.
  user: readUser(),
  initialising: true,
  submitting: false,
  error: null,

  /**
   * Verify any stored token against the server on boot. A token can be present but expired or
   * signed with a rotated secret, and only the server can tell us that.
   */
  bootstrap: async () => {
    if (!readToken()) {
      set({ initialising: false, user: null });
      return;
    }
    try {
      const profile = await api.me();
      const user: StoredUser = {
        userId: profile.userId,
        username: profile.username,
        displayName: profile.displayName,
        role: profile.role,
      };
      saveSession({ ...profile, token: readToken() as string });
      set({ user, initialising: false, error: null });
    } catch {
      clearSession();
      set({ user: null, initialising: false });
    }
  },

  login: async (payload) => {
    set({ submitting: true, error: null });
    try {
      const session = await api.login(payload);
      saveSession(session);
      set({
        user: {
          userId: session.userId,
          username: session.username,
          displayName: session.displayName,
          role: session.role,
        },
        submitting: false,
      });
      return true;
    } catch (err) {
      set({
        submitting: false,
        error: err instanceof ApiError ? err.message : 'Unable to sign in right now.',
      });
      return false;
    }
  },

  register: async (payload) => {
    set({ submitting: true, error: null });
    try {
      const session = await api.register(payload);
      saveSession(session);
      set({
        user: {
          userId: session.userId,
          username: session.username,
          displayName: session.displayName,
          role: session.role,
        },
        submitting: false,
      });
      return true;
    } catch (err) {
      set({
        submitting: false,
        error: err instanceof ApiError ? err.message : 'Unable to create your account right now.',
      });
      return false;
    }
  },

  logout: () => {
    clearSession();
    set({ user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

/**
 * Sign the user out the moment any request reports an expired token. Wiring it here — outside the
 * store definition — means the listener is registered once, not on every render.
 */
let listenerAttached = false;
export function attachAuthExpiryListener(): void {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener(AUTH_EXPIRED_EVENT, () => {
    if (useAuthStore.getState().user) {
      useAuthStore.getState().logout();
    }
  });
}
