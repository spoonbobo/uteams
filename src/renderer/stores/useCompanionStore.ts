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

  // OCR capture settings
  ocrCaptureEnabled: boolean;
  ocrLanguage: string;

  // Actions
  setPosition: (x: number, y: number) => void;
  setSize: (width: number, height: number) => void;
  updateBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  toggleOcrCapture: () => void;
  setOcrCapture: (enabled: boolean) => void;
  setOcrLanguage: (language: string) => void;
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

      // Default OCR capture state
      ocrCaptureEnabled: false,
      ocrLanguage: 'eng', // Default to English

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

      toggleOcrCapture: () =>
        set((state) => ({ ocrCaptureEnabled: !state.ocrCaptureEnabled })),

      setOcrCapture: (enabled: boolean) =>
        set({ ocrCaptureEnabled: enabled }),

      setOcrLanguage: (language: string) =>
        set({ ocrLanguage: language }),
    }),
    {
      name: 'companion-store',
      // Persist position, size, and OCR capture state
      partialize: (state) => ({
        position: state.position,
        size: state.size,
        ocrCaptureEnabled: state.ocrCaptureEnabled,
        ocrLanguage: state.ocrLanguage,
      }),
    }
  )
);
