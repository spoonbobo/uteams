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

// Work tracking IPC handlers
export const registerWorkIpcHandlers = () => {
  // List all work items
  ipcMain.handle('work:list', async () => {
    try {
      const data = sqliteQuery('select * from work order by created_at desc');
      return data;
    } catch (error) {
      console.error('[work:list] Error:', error);
      return [];
    }
  });

  // Create new work item
  ipcMain.handle('work:create', async (_event, { id, createdAt, description, category, sessionId }) => {
    try {
      const sql = `
        insert into work (id, created_at, description, category, session_id)
        values (?, ?, ?, ?, ?)
      `;
      const result = sqliteQuery(sql, [id, createdAt, description, category || 'general', sessionId || null]);
      return { success: true, result };
    } catch (error) {
      console.error('[work:create] Error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Update work item
  ipcMain.handle('work:update', async (_event, { id, endedAt, description, category, sessionId }) => {
    try {
      const updates = [];
      const params = [];

      if (endedAt !== undefined) {
        updates.push('ended_at = ?');
        params.push(endedAt);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (category !== undefined) {
        updates.push('category = ?');
        params.push(category);
      }
      if (sessionId !== undefined) {
        updates.push('session_id = ?');
        params.push(sessionId);
      }

      if (updates.length === 0) {
        return { success: true, message: 'No updates provided' };
      }

      params.push(id);
      const sql = `update work set ${updates.join(', ')} where id = ?`;
      const result = sqliteQuery(sql, params);
      return { success: true, result };
    } catch (error) {
      console.error('[work:update] Error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Delete work item
  ipcMain.handle('work:delete', async (_event, { id }) => {
    try {
      const sql = 'delete from work where id = ?';
      const result = sqliteQuery(sql, [id]);
      return { success: true, result };
    } catch (error) {
      console.error('[work:delete] Error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get work by session ID
  ipcMain.handle('work:get-by-session', async (_event, { sessionId }) => {
    try {
      const sql = 'select * from work where session_id = ? order by created_at desc limit 1';
      const data = sqliteQuery(sql, [sessionId]);
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('[work:get-by-session] Error:', error);
      return null;
    }
  });
};

// Register all database IPC handlers
export const registerDatabaseIpcHandlers = () => {
  registerSqliteIpcHandlers();
  registerAppConfigHandler();
  registerWorkIpcHandlers();
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
