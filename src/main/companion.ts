import path from 'path';
import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { resolveHtmlPath } from './util';

let companionWindow: BrowserWindow | null = null;

const getPreloadPath = (): string =>
  app.isPackaged
    ? path.join(__dirname, 'preload.js')
    : path.join(__dirname, '../../.erb/dll/preload.js');

const findMainWindow = (): BrowserWindow | null => {
  try {
    const all = BrowserWindow.getAllWindows();
    for (const w of all) {
      if (!companionWindow || w.id !== companionWindow.id) return w;
    }
  } catch {}
  return null;
};

const focusMainWindow = () => {
  const main = findMainWindow();
  if (!main) return;
  try {
    if (main.isMinimized()) main.restore();
    main.show();
    main.focus();
  } catch {}
};

function createCompanionWindow(sessionId: string, sessionName: string, bounds?: { x: number; y: number; width: number; height: number }) {
  if (companionWindow && !companionWindow.isDestroyed()) {
    try {
      // Update bounds if provided, even for existing window
      if (bounds) {
        companionWindow.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });
      }
      companionWindow.focus();
      return;
    } catch {}
  }

  companionWindow = new BrowserWindow({
    width: bounds?.width || 420,
    height: bounds?.height || 620,
    x: bounds?.x || 100,
    y: bounds?.y || 100,
    alwaysOnTop: true,
    frame: false,
    resizable: true,
    movable: true,
    skipTaskbar: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  // Prevent DevTools from popping up automatically for the companion overlay
  try {
    companionWindow.webContents.on('devtools-opened', () => {
      try {
        companionWindow?.webContents.closeDevTools();
      } catch {}
    });
    // Also close if already opened by any debug tooling
    setImmediate(() => {
      try {
        if (companionWindow && companionWindow.webContents.isDevToolsOpened()) {
          companionWindow.webContents.closeDevTools();
        }
      } catch {}
    });
  } catch {}

  const url = new URL(resolveHtmlPath('index.html'));
  url.searchParams.set('overlay', 'companion');
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('sessionName', sessionName);

  companionWindow.loadURL(url.toString());

  companionWindow.on('ready-to-show', () => {
    try {
      companionWindow?.show();
      // Ensure DevTools remain closed after showing
      try {
        if (companionWindow?.webContents.isDevToolsOpened()) {
          companionWindow.webContents.closeDevTools();
        }
      } catch {}
      // Minimize main window to switch focus to companion overlay
      const main = findMainWindow();
      if (main && !main.isMinimized()) {
        try {
          main.minimize();
        } catch {}
      }
    } catch {}
  });

  // Save position and size when window is moved or resized
  companionWindow.on('moved', () => {
    try {
      if (companionWindow && !companionWindow.isDestroyed()) {
        const bounds = companionWindow.getBounds();
        // Call the global handler directly in renderer
        companionWindow.webContents.executeJavaScript(`
          if (window.companionBoundsHandler) {
            window.companionBoundsHandler(${JSON.stringify(bounds)});
          }
        `).catch(() => {
          // Ignore errors if the handler doesn't exist
        });
      }
    } catch {}
  });

  companionWindow.on('resized', () => {
    try {
      if (companionWindow && !companionWindow.isDestroyed()) {
        const bounds = companionWindow.getBounds();
        // Call the global handler directly in renderer
        companionWindow.webContents.executeJavaScript(`
          if (window.companionBoundsHandler) {
            window.companionBoundsHandler(${JSON.stringify(bounds)});
          }
        `).catch(() => {
          // Ignore errors if the handler doesn't exist
        });
      }
    } catch {}
  });

  companionWindow.on('closed', () => {
    companionWindow = null;
  });
}

function open(sessionId: string, sessionName: string, bounds?: { x: number; y: number; width: number; height: number }) {
  createCompanionWindow(sessionId, sessionName, bounds);
}

function close() {
  try {
    companionWindow?.close();
    // After closing overlay, bring main window back and focus it
    focusMainWindow();
  } catch {}
}

function isOpen(): boolean {
  return !!companionWindow && !companionWindow.isDestroyed();
}

function focus() {
  try {
    companionWindow?.focus();
  } catch {}
}

function registerIpc() {
  ipcMain.handle(
    'companion:open',
    async (
      _event: IpcMainInvokeEvent,
      payload: { sessionId: string; sessionName: string; bounds?: { x: number; y: number; width: number; height: number } },
    ) => {
      open(payload.sessionId, payload.sessionName, payload.bounds);
      return { success: true };
    },
  );

  ipcMain.handle('companion:close', async () => {
    close();
    return { success: true };
  });

  ipcMain.handle('companion:is-open', async () => isOpen());
  ipcMain.handle('companion:focus', async () => {
    focus();
    return { success: true };
  });
}

export const companionManager = {
  open,
  close,
  isOpen,
  focus,
  registerIpc,
};


