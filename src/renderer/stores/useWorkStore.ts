import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Work } from '../types/work';
import { useLayoutStore } from './useLayoutStore';

export type TimeRange = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface CustomTimeRange {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

type WorkState = {
  works: Work[];
  isLoading: boolean;
  activeWork: Work | null; // Currently ongoing work

  // CRUD operations
  loadWorks: () => Promise<void>;
  loadWorksByTimeRange: (timeRange: TimeRange, customRange?: CustomTimeRange) => Promise<void>;
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

  // Time range filtering
  filterWorksByTimeRange: (timeRange: TimeRange, customRange?: CustomTimeRange) => Work[];
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

        // Trigger new work badge notification
        useLayoutStore.getState().setNewWorkBadge(true);

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

      // Badge is already triggered by createWork, but ensure it's set
      useLayoutStore.getState().setNewWorkBadge(true);

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

    loadWorksByTimeRange: async (timeRange: TimeRange, customRange?: CustomTimeRange) => {
      set({ isLoading: true }, false, 'work:load:start');
      try {
        let sql = 'select * from work';
        const params: any[] = [];

        if (timeRange !== 'all') {
          const now = new Date();
          let startDate: Date;

          switch (timeRange) {
            case 'today':
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              sql += ' where created_at >= ?';
              params.push(startDate.toISOString());
              break;
            case 'week':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              sql += ' where created_at >= ?';
              params.push(startDate.toISOString());
              break;
            case 'month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              sql += ' where created_at >= ?';
              params.push(startDate.toISOString());
              break;
            case 'custom':
              if (customRange) {
                sql += ' where created_at >= ? and created_at <= ?';
                params.push(customRange.startDate, customRange.endDate);
              } else {
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days
                sql += ' where created_at >= ?';
                params.push(startDate.toISOString());
              }
              break;
            default:
              // For any other case, don't add where clause
              break;
          }
        }

        sql += ' order by created_at desc';

        const rows = await (window as any).electron?.ipcRenderer?.invoke('work:query-range', {
          sql,
          params
        });

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
        console.error('[work] Failed to load works by time range:', e);
      } finally {
        set({ isLoading: false }, false, 'work:load:end');
      }
    },

    filterWorksByTimeRange: (timeRange: TimeRange, customRange?: CustomTimeRange) => {
      const works = get().works;

      if (timeRange === 'all') {
        return works;
      }

      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      switch (timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'custom':
          if (customRange) {
            startDate = new Date(customRange.startDate);
            endDate = new Date(customRange.endDate);
          } else {
            return works;
          }
          break;
        default:
          return works;
      }

      return works.filter(work => {
        const workDate = new Date(work.createdAt);
        return workDate >= startDate && workDate <= endDate;
      });
    },
  }))
);
