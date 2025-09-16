/**
 * System Alert Module
 * Provides cross-platform system notification and alert functionality
 */

import { dialog, Notification, BrowserWindow, app, ipcMain } from 'electron';

export interface AlertOptions {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'question';
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
  icon?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
  timeoutType?: 'default' | 'never';
  actions?: Array<{
    type: 'button';
    text: string;
  }>;
}

export interface ToastOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

/**
 * Show a system dialog alert
 */
export async function showAlert(options: AlertOptions): Promise<{
  response: number;
  checkboxChecked?: boolean;
}> {
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  
  const dialogOptions: Electron.MessageBoxOptions = {
    type: options.type || 'info',
    title: options.title,
    message: options.message,
    buttons: options.buttons || ['OK'],
    defaultId: options.defaultId || 0,
    cancelId: options.cancelId,
  };

  if (options.icon) {
    dialogOptions.icon = options.icon;
  }

  if (mainWindow) {
    return await dialog.showMessageBox(mainWindow, dialogOptions);
  } else {
    return await dialog.showMessageBox(dialogOptions);
  }
}

/**
 * Show a system notification
 */
export function showNotification(options: NotificationOptions): Notification | null {
  // Check if notifications are supported
  if (!Notification.isSupported()) {
    console.warn('System notifications are not supported on this platform');
    return null;
  }

  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: options.icon,
    silent: options.silent || false,
    urgency: options.urgency || 'normal',
    timeoutType: options.timeoutType || 'default',
    actions: options.actions || [],
  });

  notification.show();
  return notification;
}

/**
 * Show an error alert
 */
export async function showError(title: string, message: string): Promise<void> {
  await showAlert({
    title,
    message,
    type: 'error',
    buttons: ['OK'],
  });
}

/**
 * Show a warning alert
 */
export async function showWarning(title: string, message: string): Promise<void> {
  await showAlert({
    title,
    message,
    type: 'warning',
    buttons: ['OK'],
  });
}

/**
 * Show an info alert
 */
export async function showInfo(title: string, message: string): Promise<void> {
  await showAlert({
    title,
    message,
    type: 'info',
    buttons: ['OK'],
  });
}

/**
 * Show a confirmation dialog
 */
export async function showConfirm(
  title: string,
  message: string,
  confirmText: string = 'Yes',
  cancelText: string = 'No'
): Promise<boolean> {
  const result = await showAlert({
    title,
    message,
    type: 'question',
    buttons: [confirmText, cancelText],
    defaultId: 0,
    cancelId: 1,
  });

  return result.response === 0;
}

/**
 * Show a toast-style notification to the renderer
 * This sends a message to the renderer to show a toast
 */
export function showToast(options: ToastOptions): void {
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  
  if (mainWindow) {
    mainWindow.webContents.send('alert:toast', options);
  }
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  return Notification.isSupported();
}

/**
 * Request notification permissions (mainly for macOS)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (process.platform === 'darwin') {
    // On macOS, we need to request permission
    try {
      const hasPermission = await app.requestSingleInstanceLock();
      return hasPermission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }
  
  // On other platforms, notifications are generally available
  return Notification.isSupported();
}

/**
 * Setup Alert IPC handlers
 */
export function setupAlertHandlers(): void {
  // Show system alert dialog
  ipcMain.handle('alert:show', async (event, options: AlertOptions) => {
    try {
      return await showAlert(options);
    } catch (error) {
      console.error('Error showing alert:', error);
      throw error;
    }
  });

  // Show system notification
  ipcMain.handle('alert:notification', async (event, options: NotificationOptions) => {
    try {
      const notification = showNotification(options);
      return { success: true, notification: notification !== null };
    } catch (error) {
      console.error('Error showing notification:', error);
      throw error;
    }
  });

  // Show error alert
  ipcMain.handle('alert:error', async (event, title: string, message: string) => {
    try {
      await showError(title, message);
      return { success: true };
    } catch (error) {
      console.error('Error showing error alert:', error);
      throw error;
    }
  });

  // Show warning alert
  ipcMain.handle('alert:warning', async (event, title: string, message: string) => {
    try {
      await showWarning(title, message);
      return { success: true };
    } catch (error) {
      console.error('Error showing warning alert:', error);
      throw error;
    }
  });

  // Show info alert
  ipcMain.handle('alert:info', async (event, title: string, message: string) => {
    try {
      await showInfo(title, message);
      return { success: true };
    } catch (error) {
      console.error('Error showing info alert:', error);
      throw error;
    }
  });

  // Show confirmation dialog
  ipcMain.handle('alert:confirm', async (event, title: string, message: string, confirmText?: string, cancelText?: string) => {
    try {
      const result = await showConfirm(title, message, confirmText, cancelText);
      return { confirmed: result };
    } catch (error) {
      console.error('Error showing confirmation dialog:', error);
      throw error;
    }
  });

  // Show toast notification (sent to renderer)
  ipcMain.handle('alert:toast', async (event, options: ToastOptions) => {
    try {
      showToast(options);
      return { success: true };
    } catch (error) {
      console.error('Error showing toast:', error);
      throw error;
    }
  });

  // Check if notifications are supported
  ipcMain.handle('alert:is-notification-supported', async () => {
    try {
      return { supported: isNotificationSupported() };
    } catch (error) {
      console.error('Error checking notification support:', error);
      throw error;
    }
  });

  // Request notification permission
  ipcMain.handle('alert:request-notification-permission', async () => {
    try {
      const granted = await requestNotificationPermission();
      return { granted };
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      throw error;
    }
  });

  console.log('✅ Alert IPC handlers registered');
}
