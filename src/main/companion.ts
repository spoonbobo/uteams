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

function createCompanionWindow(sessionId: string, sessionName: string) {
  if (companionWindow && !companionWindow.isDestroyed()) {
    try {
      companionWindow.focus();
      return;
    } catch {}
  }

  companionWindow = new BrowserWindow({
    width: 420,
    height: 620,
    alwaysOnTop: true,
    frame: false,
    resizable: true,
    movable: true,
    skipTaskbar: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
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

  companionWindow.on('closed', () => {
    companionWindow = null;
  });
}

function open(sessionId: string, sessionName: string) {
  createCompanionWindow(sessionId, sessionName);
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
      payload: { sessionId: string; sessionName: string },
    ) => {
      open(payload.sessionId, payload.sessionName);
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


