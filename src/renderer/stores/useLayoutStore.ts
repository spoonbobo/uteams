import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LayoutState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Work badge notification
  hasNewWorkBadge: boolean;
  setNewWorkBadge: (hasNewWork: boolean) => void;
  clearNewWorkBadge: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

      // Work badge notification
      hasNewWorkBadge: false,
      setNewWorkBadge: (hasNewWork: boolean) => set({ hasNewWorkBadge: hasNewWork }),
      clearNewWorkBadge: () => set({ hasNewWorkBadge: false }),
    }),
    {
      name: 'layout-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        hasNewWorkBadge: state.hasNewWorkBadge
      }),
    }
  )
);
