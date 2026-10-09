import { create } from 'zustand';
import { api, ApiError } from '../services/api';
import type { Repository } from '../types/repository';

interface AppState {
  repositories: Repository[];
  currentRepo: Repository | null;
  loading: boolean;
  error: string | null;

  fetchRepositories: () => Promise<void>;
  fetchRepository: (id: number) => Promise<void>;
  submitRepository: (githubUrl: string, branch?: string) => Promise<Repository | null>;
  deleteRepository: (id: number) => Promise<void>;
  clearError: () => void;
}

/**
 * Repository state. Chat transcripts deliberately live in the chat component instead — they are
 * scoped to a single repository view and should vanish on navigation, whereas this store is
 * app-lifetime state.
 */
export const useAppStore = create<AppState>((set) => ({
  repositories: [],
  currentRepo: null,
  loading: false,
  error: null,

  fetchRepositories: async () => {
    set({ loading: true, error: null });
    try {
      const repos = (await api.getRepositories()) as Repository[];
      set({ repositories: repos, loading: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ loading: false });
        return;
      }
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchRepository: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const repo = (await api.getRepository(id)) as Repository;
      set({ currentRepo: repo, loading: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ loading: false });
        return;
      }
      set({ error: (err as Error).message, loading: false });
    }
  },

  submitRepository: async (githubUrl: string, branch?: string) => {
    set({ loading: true, error: null });
    try {
      const repo = (await api.submitRepository(githubUrl, branch)) as Repository;
      // Replace-or-append: re-submitting an existing URL returns the existing row rather than
      // creating a duplicate, so a blind append would show the same repository twice.
      set((state) => ({
        repositories: [repo, ...state.repositories.filter((r) => r.id !== repo.id)],
        loading: false,
      }));
      return repo;
    } catch (err) {
      set({
        error: err instanceof ApiError ? err.message : 'Could not queue that repository.',
        loading: false,
      });
      return null;
    }
  },

  deleteRepository: async (id: number) => {
    try {
      await api.deleteRepository(id);
      set((state) => ({
        repositories: state.repositories.filter((r) => r.id !== id),
        currentRepo: state.currentRepo?.id === id ? null : state.currentRepo,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));
