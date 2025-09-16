// Toast utility for electron app using MUI components
import { useToastStore } from '@/stores/useToastStore';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  showProgress?: boolean;
  progress?: number;
}

// Toast API that integrates with the store
export const toast = {
  success: (message: string, duration?: number) => {
    const { addToast } = useToastStore.getState();
    return addToast({ message, type: 'success', autoHideDuration: duration });
  },

  error: (message: string, duration?: number) => {
    const { addToast } = useToastStore.getState();
    return addToast({ message, type: 'error', autoHideDuration: duration });
  },

  warning: (message: string, duration?: number) => {
    const { addToast } = useToastStore.getState();
    return addToast({ message, type: 'warning', autoHideDuration: duration });
  },

  info: (message: string, duration?: number) => {
    const { addToast } = useToastStore.getState();
    return addToast({ message, type: 'info', autoHideDuration: duration });
  },

  show: (options: ToastOptions) => {
    const { addToast } = useToastStore.getState();
    return addToast({
      message: options.message,
      type: options.type || 'info',
      autoHideDuration: options.duration,
      showProgress: options.showProgress,
      progress: options.progress,
    });
  },

  hide: (id: string) => {
    const { removeToast } = useToastStore.getState();
    removeToast(id);
  },

  clear: () => {
    const { clearAllToasts } = useToastStore.getState();
    clearAllToasts();
  },

  updateProgress: (id: string, progress: number) => {
    const { updateToast } = useToastStore.getState();
    updateToast(id, { progress });
  },
};

export default toast;
