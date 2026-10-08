import { create } from 'zustand';
import { Repository } from '../types/repository';
import { api } from '../services/api';

interface AppState {
  repositories: Repository[];
  currentRepo: Repository | null;
  loading: boolean;
  error: string | null;

  fetchRepositories: () => Promise<void>;
  fetchRepository: (id: number) => Promise<void>;
  submitRepository: (githubUrl: string, branch?: string) => Promise<Repository>;
  deleteRepository: (id: number) => Promise<void>;
  clearError: () => void;

  chatMessages: { role: 'user' | 'assistant'; content: string }[];
  addChatMessage: (msg: { role: 'user' | 'assistant'; content: string }) => void;
  updateLastChatMessage: (content: string) => void;
  clearChatMessages: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  repositories: [],
  currentRepo: null,
  loading: false,
  error: null,
  chatMessages: [],

  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateLastChatMessage: (content) => set((state) => {
    const newMessages = [...state.chatMessages];
    if (newMessages.length > 0) {
      newMessages[newMessages.length - 1] = { ...newMessages[newMessages.length - 1], content };
    }
    return { chatMessages: newMessages };
  }),
  clearChatMessages: () => set({ chatMessages: [] }),

  fetchRepositories: async () => {
    set({ loading: true, error: null });
    try {
      const repos = await api.getRepositories() as Repository[];
      set({ repositories: repos, loading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchRepository: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const repo = await api.getRepository(id) as Repository;
      set({ currentRepo: repo, loading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  submitRepository: async (githubUrl: string, branch?: string) => {
    set({ loading: true, error: null });
    try {
      const repo = await api.submitRepository(githubUrl, branch) as Repository;
      set((state) => ({
        repositories: [...state.repositories, repo],
        loading: false,
      }));
      return repo;
    } catch (err: unknown) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  deleteRepository: async (id: number) => {
    try {
      await api.deleteRepository(id);
      set((state) => ({
        repositories: state.repositories.filter((r) => r.id !== id),
        currentRepo: state.currentRepo?.id === id ? null : state.currentRepo,
      }));
    } catch (err: unknown) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));
