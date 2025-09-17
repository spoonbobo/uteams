import { app, ipcMain, BrowserWindow } from 'electron';

export type AppInfo = {
  productName: string;
  name: string;
  version: string;
  description: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
  userDataPath: string;
};

export const getAppInfo = (): AppInfo => {
  const name = process.env.APP_NAME || app.getName?.() || app.name || 'UTeams';
  const version = process.env.APP_VERSION || app.getVersion?.() || process.env.npm_package_version || '0.0.0';
  const description = process.env.APP_DESCRIPTION || 'AI For Everyone In THEi';
  
  return {
    productName: name,
    name,
    version,
    description,
    platform: process.platform,
    isPackaged: app.isPackaged,
    userDataPath: app.getPath('userData'),
  };
};

// Default zoom levels
const DEFAULT_ZOOM_LEVEL = 1.0;
const MIN_ZOOM_LEVEL = 0.5;
const MAX_ZOOM_LEVEL = 3.0;
const ZOOM_INCREMENT = 0.1;

export const registerAppIpcHandlers = () => {
  try {
    ipcMain.handle('app:get-info', () => getAppInfo());
    ipcMain.handle('app:get-product-name', () => getAppInfo().productName);
    ipcMain.handle('app:get-description', () => getAppInfo().description);
    
    // Zoom handlers
    ipcMain.handle('app:zoom-in', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        const currentZoom = win.webContents.getZoomFactor();
        const newZoom = Math.min(currentZoom + ZOOM_INCREMENT, MAX_ZOOM_LEVEL);
        win.webContents.setZoomFactor(newZoom);
        return newZoom;
      }
      return DEFAULT_ZOOM_LEVEL;
    });
    
    ipcMain.handle('app:zoom-out', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        const currentZoom = win.webContents.getZoomFactor();
        const newZoom = Math.max(currentZoom - ZOOM_INCREMENT, MIN_ZOOM_LEVEL);
        win.webContents.setZoomFactor(newZoom);
        return newZoom;
      }
      return DEFAULT_ZOOM_LEVEL;
    });
    
    ipcMain.handle('app:zoom-reset', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.setZoomFactor(DEFAULT_ZOOM_LEVEL);
        return DEFAULT_ZOOM_LEVEL;
      }
      return DEFAULT_ZOOM_LEVEL;
    });
    
    ipcMain.handle('app:get-zoom-level', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        return win.webContents.getZoomFactor();
      }
      return DEFAULT_ZOOM_LEVEL;
    });
    
    ipcMain.handle('app:set-zoom-level', (_, zoomLevel: number) => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        const clampedZoom = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, zoomLevel));
        win.webContents.setZoomFactor(clampedZoom);
        return clampedZoom;
      }
      return DEFAULT_ZOOM_LEVEL;
    });
  } catch (e) {
    // no-op; handlers may already be registered in hot-reload scenarios
  }
};


