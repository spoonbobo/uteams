import { ipcMain } from 'electron';
import { Client } from 'pg';
import {
  initializeDatabase as sqliteInit,
  closeDatabase as sqliteClose,
  executeQuery as sqliteQuery,
  executeTransaction as sqliteTx,
  runMigrations as sqliteMigrate,
  getDatabaseFilePath,
} from './index';

let dbClient: Client | null = null;

// PostgreSQL IPC handlers
export const registerPostgresIpcHandlers = () => {
  ipcMain.handle('db:connect', async (event, config) => {
    try {
      if (dbClient) {
        await dbClient.end();
      }

      dbClient = new Client({
        host: config.host || 'localhost',
        port: config.port || 5432,
        database: config.database || 'ezzzbet_db',
        user: config.user || 'ezzzbet_user',
        password: config.password || 'ezzzbet_pass',
      });

      await dbClient.connect();
      console.log('Database connected successfully');
      return { success: true };
    } catch (error) {
      console.error('Database connection failed:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:query', async (event, { sql, params = [] }) => {
    try {
      if (!dbClient) {
        throw new Error('Database not connected');
      }

      const result = await dbClient.query(sql, params);
      return {
        success: true,
        data: {
          rows: result.rows,
          rowCount: result.rowCount,
        },
      };
    } catch (error) {
      console.error('Database query failed:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('db:disconnect', async () => {
    try {
      if (dbClient) {
        await dbClient.end();
        dbClient = null;
        console.log('Database disconnected');
      }
      return { success: true };
    } catch (error) {
      console.error('Database disconnect failed:', error);
      return { success: false, error: (error as Error).message };
    }
  });
};

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
      database: {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        database: process.env.PGDATABASE || 'ezzzbet_db',
        user: process.env.PGUSER || 'ezzzbet_user',
        password: process.env.PGPASSWORD || 'ezzzbet_pass',
      },
    };
  });
};

// Register all database IPC handlers
export const registerDatabaseIpcHandlers = () => {
  registerPostgresIpcHandlers();
  registerSqliteIpcHandlers();
  registerAppConfigHandler();
};

// Cleanup function for database connections
export const cleanupDatabaseConnections = async () => {
  // Clean up PostgreSQL connection
  if (dbClient) {
    try {
      await dbClient.end();
      dbClient = null;
      console.log('PostgreSQL connection closed');
    } catch (error) {
      console.error('Error closing PostgreSQL connection:', error);
    }
  }

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
