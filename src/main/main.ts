/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import './env';
import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { initializeAgents, registerAgentIpc, cleanupAgents } from './ai';
import { registerChatIpc } from './chat';
import { registerAppIpcHandlers, getAppInfo } from './app';
import { registerMemoryIpc } from './ai/memoryIpc';
import { companionManager } from './companion';
import {
  registerDatabaseIpcHandlers,
  cleanupDatabaseConnections,
  initializeSqliteOnStartup,
} from './db';
import { setupMoodleHandlers } from './moodle';
import { setupFileIOHandlers, registerSecureFileProtocol } from './fileio';
import { setupDocxHandlers } from './msftdocx';
import { setupAlertHandlers } from './alert';
import { setupOcrHandlers } from './ocr';
import { setupPdfHandlers } from './pdfTool';
import { setupOrtHandlers, cleanupORT } from './ort';

// Debug: Log environment variable loading
console.log('🔧 Environment variables loaded:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log(
  '  - OPENAI_API_KEY:',
  process.env.OPENAI_API_KEY ? 'Set ✅' : 'Not set ❌',
);
console.log(
  '  - TAVILY_API_KEY:',
  process.env.TAVILY_API_KEY ? 'Set ✅' : 'Not set ❌',
);
console.log(
  '  - MOODLE_BASE_URL:',
  process.env.MOODLE_BASE_URL || 'Using default: https://moodle.onlysaid.com',
);

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// Research Agent IPC handlers moved to ./research

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    minWidth: 800,
    minHeight: 600,
    icon: getAssetPath('icon.png'),
    frame: false, // Remove default frame
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', // macOS specific
    transparent: false, // Set to true if you want transparency
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });


  // Register core handlers early to ensure they're available when renderer loads
  try {
    setupMoodleHandlers();
    console.log('✅ Moodle handlers registered early');
  } catch (e) {
    console.error('Failed to register Moodle handlers early', e);
  }

  try {
    setupFileIOHandlers();
    console.log('✅ File I/O handlers registered early');
  } catch (e) {
    console.error('Failed to register File I/O handlers early', e);
  }

  try {
    setupDocxHandlers();
    console.log('✅ DOCX handlers registered early');
  } catch (e) {
    console.error('Failed to register DOCX handlers early', e);
  }

  try {
    setupAlertHandlers();
    console.log('✅ Alert handlers registered early');
  } catch (e) {
    console.error('Failed to register Alert handlers early', e);
  }

  try {
    setupOcrHandlers();
    console.log('✅ OCR handlers registered early');
  } catch (e) {
    console.error('Failed to register OCR handlers early', e);
  }

  try {
    await setupPdfHandlers();
    console.log('✅ PDF handlers registered early');
  } catch (e) {
    console.error('Failed to register PDF handlers early', e);
  }

  try {
    setupOrtHandlers();
    console.log('✅ ORT handlers registered early');
  } catch (e) {
    console.error('Failed to register ORT handlers early', e);
  }

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  // Inform renderer about app info on ready
  try {
    const info = getAppInfo();
    mainWindow.webContents.once('did-finish-load', () => {
      try {
        mainWindow?.webContents.send('app:info', info);
      } catch {}
    });
  } catch {}

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', async () => {
  // Clean up database connections
  await cleanupDatabaseConnections();

  await cleanupAgents();

  // Clean up ORT models
  await cleanupORT();

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit events to ensure cleanup
app.on('before-quit', async (event) => {
  event.preventDefault();

  await cleanupAgents();

  // Clean up database connections
  await cleanupDatabaseConnections();

  // Clean up ORT models
  await cleanupORT();

  // Now allow the app to quit
  app.exit(0);
});

// Handle process termination signals (Ctrl+C, kill, etc.)
const cleanupAndExit = async () => {
  console.log('Received termination signal, cleaning up...');

  await cleanupAgents();

  // Clean up database connections
  await cleanupDatabaseConnections();

  // Clean up ORT models
  await cleanupORT();

  // Exit the process
  process.exit(0);
};

// Register signal handlers for graceful shutdown
process.on('SIGINT', cleanupAndExit); // Ctrl+C
process.on('SIGTERM', cleanupAndExit); // Termination signal

// Windows-specific handling
if (process.platform === 'win32') {
  // Windows doesn't have SIGHUP
  process.on('SIGBREAK', cleanupAndExit); // Ctrl+Break on Windows
} else {
  process.on('SIGHUP', cleanupAndExit); // Terminal closed (Unix-like systems)
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await cleanupAndExit();
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await cleanupAndExit();
});

app
  .whenReady()
  .then(async () => {
    // Register secure custom protocol for serving local files
    registerSecureFileProtocol();

    // Register database IPC handlers
    registerDatabaseIpcHandlers();

    // Initialize SQLite after app is ready (so userData path is available)
    initializeSqliteOnStartup();

    // Register app info IPC
    try {
      registerAppIpcHandlers();
    } catch {}
    // Do not auto-start Playwright MCP server at app launch; agent will spawn MCPs on demand.
    createWindow();


    // Initialize agents - Continue even if some agents fail
    try {
    await initializeAgents();
    console.log('✅ Agents initialized successfully');
  } catch (error) {
    console.error('⚠️ Error initializing agents:', error);
      console.log('📝 App will continue with limited agent functionality');

      // Notify renderer about partial agent availability
      if (mainWindow) {
        mainWindow.webContents.send('agents:partial-availability', {
          error: error instanceof Error ? error.message : 'Some agents failed to initialize'
        });
      }
    }

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });

    // Register Companion IPC once app is ready
    try {
      companionManager.registerIpc();
    } catch (e) {
      console.error('Failed to register companion IPC', e);
    }


    // Register agent IPC
    registerAgentIpc();


    // Register chat IPC
    try {
      registerChatIpc();
    } catch (e) {
      console.error('Failed to register chat IPC', e);
    }

    // Register memory IPC
    try {
      registerMemoryIpc();
    } catch (e) {
      console.error('Failed to register memory IPC', e);
    }

    // Moodle handlers already registered early in createWindow()

    // File I/O and DOCX handlers already registered early in createWindow()
  })
  .catch(console.log);



