import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3'; // eslint-disable-line import/no-extraneous-dependencies
import { app } from 'electron';
import { migrations } from './migrations';

export type SQLiteRunInfo = {
  changes: number;
  lastInsertRowid: number | bigint;
};

let dbInstance: Database.Database | null = null;
let dbFilePath: string | null = null;

type InitOptions = {
  fileName?: string;
};

const ensureDirectory = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getDefaultDbPath = (fileName: string): string => {
  const userData = app?.isReady() ? app.getPath('userData') : process.cwd();
  const appName = app?.getName?.() || 'ezzzbet';
  const baseDir = path.join(userData, `${appName}-data`, 'databases');
  ensureDirectory(baseDir);
  return path.join(baseDir, fileName);
};

export const initializeDatabase = (
  options?: InitOptions,
): Database.Database => {
  if (dbInstance) return dbInstance;

  const fileName = options?.fileName ?? 'app.db';
  dbFilePath = getDefaultDbPath(fileName);

  dbInstance = new Database(dbFilePath, {
    fileMustExist: false,
    verbose: undefined,
  });

  // pragmatic defaults for desktop apps
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('busy_timeout = 5000');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('wal_autocheckpoint = 1000');

  return dbInstance;
};

export const closeDatabase = (): void => {
  if (!dbInstance) return;
  try {
    try {
      dbInstance.pragma('wal_checkpoint(FULL)');
    } catch {}
    dbInstance.close();
  } finally {
    dbInstance = null;
  }
};

const convertBooleanParams = (
  params: Record<string, unknown>,
): Record<string, unknown> => {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'boolean') {
      converted[key] = value ? 1 : 0;
    } else {
      converted[key] = value;
    }
  }
  return converted;
};

const isReadOnly = (sql: string): boolean => {
  const q = sql.trim().toLowerCase();
  if (q.startsWith('select')) return true;
  if (q.startsWith('pragma')) {
    // read pragma has no '=' or '('
    return !/=|\(/.test(q);
  }
  return false;
};

export const executeQuery = <T = unknown>(
  sql: string,
  params: Record<string, unknown> | unknown[] = {},
): T[] | SQLiteRunInfo[] => {
  if (!dbInstance) initializeDatabase();
  if (!dbInstance) throw new Error('database not initialized');

  let processed: unknown;
  if (Array.isArray(params)) {
    processed = params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
  } else {
    processed = convertBooleanParams(params as Record<string, unknown>);
  }

  const stmt = dbInstance.prepare(sql);
  if (isReadOnly(sql)) {
    return stmt.all(processed) as T[];
  }
  const info = stmt.run(processed);
  return [
    {
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid,
    },
  ];
};

export const executeTransaction = <T>(
  callback: (db: Database.Database) => T,
): T => {
  if (!dbInstance) initializeDatabase();
  if (!dbInstance) throw new Error('database not initialized');
  const tx = dbInstance.transaction(callback);
  return tx(dbInstance);
};

export type Migration = {
  id: string;
  name: string;
  up: string | ((db: Database.Database) => void);
};

const ensureMigrationsTable = (db: Database.Database): void => {
  db.exec(
    [
      'create table if not exists migration_meta (',
      '  id text primary key,',
      '  name text not null,',
      '  applied_at text default (datetime(current_timestamp))',
      ')',
    ].join(' '),
  );
};

const getAppliedMigrationIds = (db: Database.Database): Set<string> => {
  const rows = db.prepare('select id from migration_meta').all() as {
    id: string;
  }[];
  return new Set(rows.map((r) => r.id));
};

export const runMigrations = (): void => {
  if (!dbInstance) initializeDatabase();
  if (!dbInstance) throw new Error('database not initialized');

  ensureMigrationsTable(dbInstance);
  const applied = getAppliedMigrationIds(dbInstance);

  executeTransaction(() => {
    for (const m of migrations) {
      if (applied.has(m.id)) continue;
      if (typeof m.up === 'string') {
        dbInstance!.exec(m.up);
      } else {
        m.up(dbInstance!);
      }
      dbInstance!
        .prepare('insert into migration_meta (id, name) values (?, ?)')
        .run(m.id, m.name);
    }
  });
};

export const getDatabaseFilePath = (): string | null => dbFilePath;

// Re-export IPC handlers for convenience
export {
  registerDatabaseIpcHandlers,
  cleanupDatabaseConnections,
  initializeSqliteOnStartup,
} from './ipcHandlers';
