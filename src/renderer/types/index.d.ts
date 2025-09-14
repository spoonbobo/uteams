// Type definitions for the EzzzBet application

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

// Bet types are now in ./bet.ts
export type { Bet, BetSession, BetSportType, BetState, BetStatus } from './bet';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface AppTheme {
  mode: 'light' | 'dark';
  primaryColor: string;
  secondaryColor: string;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  timestamp: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Electron IPC types
export interface ElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, data?: any) => Promise<any>;
    on: (channel: string, callback: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
