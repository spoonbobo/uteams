// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'db:connect'
  | 'db:query'
  | 'db:disconnect'
  | 'app:get-config'
  | 'app:set-config'
  | 'chat:list'
  | 'chat:add'
  | 'chat:delete'
  | 'chat:agent:run'
  | 'chat:agent:chunk'
  | 'chat:agent:done'
  | 'chat:agent:error'
  | 'chat:agent:plan'
  | 'chat:agent:todos'
  | 'chat:agent:todo-update'
  | 'moodle:test-connection'
  | 'moodle:save-config'
  | 'moodle:get-config'
  | 'moodle:clear-config'
  | 'moodle:get-preset-url'
  | 'alert:toast'
  | 'fullscreen-changed'
  | 'fullscreen-changing';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event: any, ...args: any[]) => func(...args));
    },
    invoke(channel: string, data?: any) {
      return ipcRenderer.invoke(channel, data);
    },
    removeAllListeners(channel: Channels) {
      ipcRenderer.removeAllListeners(channel);
    },
  },
  playwright: {
    // Legacy global browser methods
    initialize: () => ipcRenderer.invoke('playwright:initialize'),
    navigate: (url: string) => ipcRenderer.invoke('playwright:navigate', url),
    executeScript: (script: string) =>
      ipcRenderer.invoke('playwright:execute-script', script),
    takeScreenshot: () => ipcRenderer.invoke('playwright:screenshot'),
    getBrowserInfo: () => ipcRenderer.invoke('playwright:get-info'),
    close: () => ipcRenderer.invoke('playwright:close'),

    // Session-based browser methods
    initializeSession: (browserId: string) =>
      ipcRenderer.invoke('playwright:initialize-session', browserId),
    navigateSession: (browserId: string, url: string) =>
      ipcRenderer.invoke('playwright:navigate-session', browserId, url),
    executeSessionScript: (browserId: string, script: string) =>
      ipcRenderer.invoke(
        'playwright:execute-session-script',
        browserId,
        script,
      ),
    takeSessionScreenshot: (browserId: string) =>
      ipcRenderer.invoke('playwright:take-session-screenshot', browserId),
    getSessionInfo: (browserId: string) =>
      ipcRenderer.invoke('playwright:get-session-info', browserId),
    closeSession: (browserId: string) =>
      ipcRenderer.invoke('playwright:close-session', browserId),
    closeAllSessions: () => ipcRenderer.invoke('playwright:close-all-sessions'),

    // MCP-specific browser methods
    clickElement: (browserId: string, element: string, ref: string) =>
      ipcRenderer.invoke('playwright:click-element', browserId, element, ref),
    typeText: (
      browserId: string,
      element: string,
      ref: string,
      text: string,
      submit?: boolean,
    ) =>
      ipcRenderer.invoke(
        'playwright:type-text',
        browserId,
        element,
        ref,
        text,
        submit,
      ),
    getPageSnapshot: (browserId: string) =>
      ipcRenderer.invoke('playwright:get-page-snapshot', browserId),
    waitForElement: (browserId: string, text: string, timeout?: number) =>
      ipcRenderer.invoke(
        'playwright:wait-for-element',
        browserId,
        text,
        timeout,
      ),

    // Configuration methods
    setHeadlessMode: (headless: boolean) =>
      ipcRenderer.invoke('playwright:set-headless-mode', headless),
    isHeadless: () => ipcRenderer.invoke('playwright:is-headless'),
  },
  mcp: {
    startServer: (port?: number) =>
      ipcRenderer.invoke('mcp:start-server', port),
    stopServer: () => ipcRenderer.invoke('mcp:stop-server'),
    serverInfo: () => ipcRenderer.invoke('mcp:server-info'),
    serverStatus: () => ipcRenderer.invoke('mcp:server-status'),
  },
  companion: {
    open: (sessionId: string, sessionName: string, bounds?: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('companion:open', { sessionId, sessionName, bounds }),
    close: () => ipcRenderer.invoke('companion:close'),
    isOpen: () => ipcRenderer.invoke('companion:is-open'),
    focus: () => ipcRenderer.invoke('companion:focus'),
  },
  alert: {
    // Show system alert dialog
    show: (options: {
      title: string;
      message: string;
      type?: 'info' | 'warning' | 'error' | 'question';
      buttons?: string[];
      defaultId?: number;
      cancelId?: number;
      icon?: string;
    }) => ipcRenderer.invoke('alert:show', options),

    // Show system notification
    notification: (options: {
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
    }) => ipcRenderer.invoke('alert:notification', options),

    // Show error alert
    error: (title: string, message: string) =>
      ipcRenderer.invoke('alert:error', title, message),

    // Show warning alert
    warning: (title: string, message: string) =>
      ipcRenderer.invoke('alert:warning', title, message),

    // Show info alert
    info: (title: string, message: string) =>
      ipcRenderer.invoke('alert:info', title, message),

    // Show confirmation dialog
    confirm: (
      title: string,
      message: string,
      confirmText?: string,
      cancelText?: string
    ) => ipcRenderer.invoke('alert:confirm', title, message, confirmText, cancelText),

    // Show toast notification (sent to renderer)
    toast: (options: {
      title: string;
      message: string;
      type?: 'success' | 'error' | 'warning' | 'info';
      duration?: number;
    }) => ipcRenderer.invoke('alert:toast', options),

    // Check if notifications are supported
    isNotificationSupported: () =>
      ipcRenderer.invoke('alert:is-notification-supported'),

    // Request notification permission
    requestNotificationPermission: () =>
      ipcRenderer.invoke('alert:request-notification-permission'),

    // Listen for toast messages from main process
    onToast: (callback: (options: {
      title: string;
      message: string;
      type?: 'success' | 'error' | 'warning' | 'info';
      duration?: number;
    }) => void) => {
      const subscription = (_event: IpcRendererEvent, options: any) => callback(options);
      ipcRenderer.on('alert:toast', subscription);
      return () => ipcRenderer.removeListener('alert:toast', subscription);
    },
  },
  ocr: {
    // Perform OCR on an image file
    perform: (imagePath: string, options?: {
      language?: string;
      timeout?: number;
    }) => ipcRenderer.invoke('ocr:perform', imagePath, options),

    // Get available OCR languages
    getLanguages: () => ipcRenderer.invoke('ocr:getLanguages'),

    // Perform OCR on a screenshot of the entire screen
    screenshot: (options?: {
      language?: string;
      timeout?: number;
    }) => ipcRenderer.invoke('ocr:screenshot', options),

    // Run OCR diagnostics
    diagnostics: () => ipcRenderer.invoke('ocr:diagnostics'),

    // Test minimal OCR functionality
    testMinimal: () => ipcRenderer.invoke('ocr:testMinimal'),

    // Clean up temporary screenshot files
    cleanup: (filePath: string) => ipcRenderer.invoke('ocr:cleanup', filePath),
  },
  ort: {
    // Initialize ORT runtime
    initialize: () => ipcRenderer.invoke('ort:initialize'),

    // Load a model from file path
    loadModel: (modelPath: string) => ipcRenderer.invoke('ort:load-model', modelPath),

    // Run inference on a loaded model
    inference: (modelPath: string, inputData: Record<string, number[] | number[][]>) =>
      ipcRenderer.invoke('ort:inference', modelPath, inputData),

    // Time series forecasting
    forecastTimeSeries: (
      timeSeriesData: Array<{ date: string; amount: number }>,
      forecastDays?: number
    ) => ipcRenderer.invoke('ort:forecast-timeseries', timeSeriesData, forecastDays),

    // Get model information
    getModelInfo: (modelPath: string) => ipcRenderer.invoke('ort:model-info', modelPath),

    // Cleanup models
    cleanup: () => ipcRenderer.invoke('ort:cleanup'),
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
