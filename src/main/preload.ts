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
  | 'moodle:get-preset-url';

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
    open: (sessionId: string, sessionName: string) =>
      ipcRenderer.invoke('companion:open', { sessionId, sessionName }),
    close: () => ipcRenderer.invoke('companion:close'),
    isOpen: () => ipcRenderer.invoke('companion:is-open'),
    focus: () => ipcRenderer.invoke('companion:focus'),
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
