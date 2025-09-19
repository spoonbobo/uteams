import { ipcMain } from 'electron';
import {
  initializeDatabase as sqliteInit,
  closeDatabase as sqliteClose,
  executeQuery as sqliteQuery,
  executeTransaction as sqliteTx,
  runMigrations as sqliteMigrate,
  getDatabaseFilePath,
} from './index';


// SQLite IPC handlers
export const registerSqliteIpcHandlers = () => {
  ipcMain.handle('sqlite:init', async () => {
    try {
      sqliteInit();
      sqliteMigrate();
      return { success: true, path: getDatabaseFilePath() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sqlite:query', async (_event, { sql, params = [] }) => {
    try {
      const data = sqliteQuery(sql, params);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sqlite:transaction', async (_event, { ops }) => {
    try {
      const data = sqliteTx((db) => {
        const results: unknown[] = [];
        for (const op of ops as Array<{
          sql: string;
          params?: unknown[] | Record<string, unknown>;
        }>) {
          const stmt = db.prepare(op.sql);
          const isRead = /^\s*select|^\s*pragma(?!.*[=(])/i.test(op.sql);
          if (isRead) {
            results.push(stmt.all(op.params ?? []));
          } else {
            const info = stmt.run(op.params ?? []);
            results.push({
              changes: info.changes,
              lastInsertRowid: info.lastInsertRowid,
            });
          }
        }
        return results;
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sqlite:close', async () => {
    try {
      sqliteClose();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
};

// App configuration handler
export const registerAppConfigHandler = () => {
  ipcMain.handle('app:get-config', () => {
    return {
      // App configuration without PostgreSQL settings
    };
  });
};

// Register all database IPC handlers
export const registerDatabaseIpcHandlers = () => {
  registerSqliteIpcHandlers();
  registerAppConfigHandler();
};

// Cleanup function for database connections
export const cleanupDatabaseConnections = async () => {
  // Clean up SQLite connection
  try {
    sqliteClose();
    console.log('SQLite connection closed');
  } catch (error) {
    console.error('Error closing SQLite connection:', error);
  }
};

// Initialize SQLite on startup
export const initializeSqliteOnStartup = () => {
  try {
    sqliteInit();
    sqliteMigrate();
    console.log('SQLite ready at', getDatabaseFilePath());
    return true;
  } catch (e) {
    console.warn('SQLite init/migrate failed:', e);
    return false;
  }
};
