import { app, ipcMain } from 'electron';

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

export const registerAppIpcHandlers = () => {
  try {
    ipcMain.handle('app:get-info', () => getAppInfo());
    ipcMain.handle('app:get-product-name', () => getAppInfo().productName);
    ipcMain.handle('app:get-description', () => getAppInfo().description);
  } catch (e) {
    // no-op; handlers may already be registered in hot-reload scenarios
  }
};


