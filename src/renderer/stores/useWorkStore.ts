import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Work } from '../types/work';

type WorkState = {
  works: Work[];
  isLoading: boolean;
  activeWork: Work | null; // Currently ongoing work

  // CRUD operations
  loadWorks: () => Promise<void>;
  createWork: (description: string, category?: string, sessionId?: string) => Promise<Work>;
  updateWork: (id: string, updates: Partial<Omit<Work, 'id' | 'createdAt'>>) => Promise<void>;
  endWork: (id: string) => Promise<void>;
  deleteWork: (id: string) => Promise<void>;

  // Session management
  startWorkForSession: (sessionId: string, description: string, category?: string) => Promise<Work>;
  endWorkForSession: (sessionId: string) => Promise<void>;
  getWorkBySession: (sessionId: string) => Work | undefined;

  // Active work management
  setActiveWork: (work: Work | null) => void;
  getActiveWork: () => Work | null;
};

export const useWorkStore = create<WorkState>()(
  devtools((set, get) => ({
    works: [],
    isLoading: false,
    activeWork: null,

    loadWorks: async () => {
      set({ isLoading: true }, false, 'work:load:start');
      try {
        const rows = await (window as any).electron?.ipcRenderer?.invoke('work:list');
        const works: Work[] = Array.isArray(rows)
          ? rows.map((r: any) => ({
              id: String(r.id),
              createdAt: String(r.created_at),
              endedAt: r.ended_at ? String(r.ended_at) : undefined,
              description: String(r.description ?? ''),
              category: String(r.category ?? 'general'),
              sessionId: r.session_id ? String(r.session_id) : undefined,
            }))
          : [];
        set({ works }, false, 'work:load:success');
      } catch (e) {
        console.error('[work] Failed to load works:', e);
      } finally {
        set({ isLoading: false }, false, 'work:load:end');
      }
    },

    createWork: async (description: string, category = 'general', sessionId?: string) => {
      const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
      const createdAt = new Date().toISOString();

      const work: Work = {
        id,
        createdAt,
        description,
        category,
        sessionId,
      };

      // Optimistic update
      set(
        (s) => ({
          works: [...s.works, work],
        }),
        false,
        'work:create:optimistic',
      );

      try {
        await (window as any).electron?.ipcRenderer?.invoke('work:create', {
          id,
          createdAt,
          description,
          category,
          sessionId,
        });
        return work;
      } catch (e) {
        console.error('[work] Failed to create work:', e);
        // Rollback on error
        set(
          (s) => ({
            works: s.works.filter((w) => w.id !== id),
          }),
          false,
          'work:create:rollback',
        );
        throw e;
      }
    },

    updateWork: async (id: string, updates: Partial<Omit<Work, 'id' | 'createdAt'>>) => {
      // Optimistic update
      set(
        (s) => ({
          works: s.works.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        }),
        false,
        'work:update:optimistic',
      );

      try {
        await (window as any).electron?.ipcRenderer?.invoke('work:update', { id, ...updates });
      } catch (e) {
        console.error('[work] Failed to update work:', e);
        // Could implement rollback here if needed
      }
    },

    endWork: async (id: string) => {
      const endedAt = new Date().toISOString();
      await get().updateWork(id, { endedAt });

      // Clear active work if this was the active one
      const activeWork = get().activeWork;
      if (activeWork?.id === id) {
        set({ activeWork: null }, false, 'work:active:clear');
      }
    },

    deleteWork: async (id: string) => {
      // Optimistic remove
      set(
        (s) => ({
          works: s.works.filter((w) => w.id !== id),
        }),
        false,
        'work:delete:optimistic',
      );

      try {
        await (window as any).electron?.ipcRenderer?.invoke('work:delete', { id });
      } catch (e) {
        console.error('[work] Failed to delete work:', e);
        // Could implement rollback here if needed
      }
    },

    startWorkForSession: async (sessionId: string, description: string, category = 'general') => {
      // End any existing work for this session first
      await get().endWorkForSession(sessionId);

      const work = await get().createWork(description, category, sessionId);
      set({ activeWork: work }, false, 'work:active:set');
      return work;
    },

    endWorkForSession: async (sessionId: string) => {
      const work = get().getWorkBySession(sessionId);
      if (work && !work.endedAt) {
        await get().endWork(work.id);
      }
    },

    getWorkBySession: (sessionId: string) => {
      // Get the most recent active work for this session
      return get().works
        .filter((w) => w.sessionId === sessionId && !w.endedAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    },

    setActiveWork: (work: Work | null) => {
      set({ activeWork: work }, false, 'work:active:set');
    },

    getActiveWork: () => {
      return get().activeWork;
    },
  }))
);
