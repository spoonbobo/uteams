import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CompanionState {
  // Window position and size
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };

  // Actions
  setPosition: (x: number, y: number) => void;
  setSize: (width: number, height: number) => void;
  updateBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
}

export const useCompanionStore = create<CompanionState>()(
  persist(
    (set) => ({
      // Default position and size
      position: {
        x: 100,
        y: 100,
      },
      size: {
        width: 420,
        height: 620,
      },

      // Actions
      setPosition: (x: number, y: number) =>
        set({ position: { x, y } }),

      setSize: (width: number, height: number) =>
        set({ size: { width, height } }),

      updateBounds: (bounds) =>
        set({
          position: { x: bounds.x, y: bounds.y },
          size: { width: bounds.width, height: bounds.height }
        }),
    }),
    {
      name: 'companion-store',
      // Only persist position and size
      partialize: (state) => ({
        position: state.position,
        size: state.size,
      }),
    }
  )
);
