import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ToastMessage } from '../types/message';

interface ToastState {
  toasts: ToastMessage[];

  // Actions
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<ToastMessage>) => void;
  clearAllToasts: () => void;
}

export const useToastStore = create<ToastState>()(
  devtools(
    (set, get) => ({
      // Initial state
      toasts: [],

      // Actions
      addToast: (toastData) => {
        const id = Date.now().toString();
        const toast: ToastMessage = {
          id,
          autoHideDuration: 4000,
          showProgress: false,
          progress: 0,
          ...toastData,
        };

        set(
          (state) => ({
            toasts: [...state.toasts, toast],
          }),
          false,
          'addToast',
        );

        // Auto-remove toast after duration
        if (toast.autoHideDuration && toast.autoHideDuration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, toast.autoHideDuration);
        }

        return id;
      },

      removeToast: (id) => {
        set(
          (state) => ({
            toasts: state.toasts.filter((toast) => toast.id !== id),
          }),
          false,
          'removeToast',
        );
      },

      updateToast: (id, updates) => {
        set(
          (state) => ({
            toasts: state.toasts.map((toast) =>
              toast.id === id ? { ...toast, ...updates } : toast,
            ),
          }),
          false,
          'updateToast',
        );
      },

      clearAllToasts: () => {
        set({ toasts: [] }, false, 'clearAllToasts');
      },
    }),
    {
      name: 'toast-store',
    },
  ),
);
