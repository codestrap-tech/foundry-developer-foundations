import initSqlJs from 'sql.js';
import * as path from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import type {
  Threads,
  ThreadsDao,
} from '@codestrap/developer-foundations-types';

let SQL: any = null;
let db: any = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

// Note: In VSCode extension context, the DB path should be set via environment variable
// by the extension.ts file using proper VSCode workspace APIs
const DEFAULT_DB_PATH = path.resolve(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('os').homedir(),
  'larry-db/developer-foundations-threads.sqlite',
);

async function initDatabase(
  dbPath: string = process.env['SQL_LITE_DB_PATH'] || DEFAULT_DB_PATH,
): Promise<void> {
  // If already initialized, return
  if (db) return;

  // If currently initializing, wait for it to complete
  if (isInitializing && initPromise) {
    return initPromise;
  }

  // Start initialization
  isInitializing = true;
  initPromise = performInitialization(dbPath);

  try {
    await initPromise;
  } finally {
    isInitializing = false;
    initPromise = null;
  }
}

async function performInitialization(dbPath: string): Promise<void> {
  console.log('Initializing database at:', dbPath);

  // Initialize sql.js
  if (!SQL) {
    SQL = await initSqlJs();
  }

  await mkdir(path.dirname(dbPath), { recursive: true });

  // Try to load existing database file
  let data: Uint8Array | undefined;
  try {
    const buffer = await readFile(dbPath);
    data = new Uint8Array(buffer);
    console.log('Loaded existing database file, size:', data.length, 'bytes');
  } catch (e) {
    console.log('Database file does not exist, creating new database');
  }

  // Create or open database
  db = new SQL.Database(data);

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      appId TEXT,
      messages TEXT,
      userId TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_threads_appId ON threads(appId);');

  // Save database to file
  await saveDatabase(dbPath);
}

async function saveDatabase(dbPath: string): Promise<void> {
  if (!db) {
    console.log('saveDatabase: No database instance to save');
    return;
  }

  const data = db.export();
  await writeFile(dbPath, Buffer.from(data));
  console.log(
    'saveDatabase: Saved database to',
    dbPath,
    'size:',
    data.length,
    'bytes',
  );
}

function ensureDb() {
  if (!db) {
    throw new Error(
      'SQLite threads store not initialized. Call ensureInitialized() first.',
    );
  }
}

function run(sql: string, params: unknown[] = []): void {
  ensureDb();
  db.run(sql, params);
}

function get<T = any>(sql: string, params: unknown[] = []): T | undefined {
  ensureDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const hasData = stmt.step();
  const result = hasData ? stmt.getAsObject() : undefined;
  stmt.free();
  return result as T | undefined;
}

async function ensureInitialized() {
  await initDatabase();
}

export function makeSqlLiteThreadsDao(): ThreadsDao {
  return {
    upsert: async (
      messages: string,
      appId: string,
      id?: string,
    ): Promise<Threads> => {
      await ensureInitialized();

      const threadId = id || randomUUID();
      console.log('SAVING TO DB', threadId, appId);
      const sql = `INSERT INTO threads (id, appId, messages, userId, updated_at) VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET appId=excluded.appId, messages=excluded.messages, updated_at=CURRENT_TIMESTAMP`;

      run(sql, [threadId, appId, messages]);

      const row = get<{
        id: string;
        appId: string | null;
        messages: string | null;
        userId: string | null;
      }>('SELECT id, appId, messages, userId FROM threads WHERE id = ?', [
        threadId,
      ]);

      if (!row) {
        throw new Error('Failed to upsert and retrieve thread');
      }

      const thread: Threads = {
        id: row.id,
        appId: row.appId ?? undefined,
        messages: row.messages ?? undefined,
        userId: row.userId ?? undefined,
      };

      // Save to file
      const dbPath = process.env['SQL_LITE_DB_PATH'] || DEFAULT_DB_PATH;
      await saveDatabase(dbPath);

      return thread;
    },

    delete: async (id: string): Promise<void> => {
      await ensureInitialized();
      run('DELETE FROM threads WHERE id = ?', [id]);

      // Save to file
      await saveDatabase(process.env['SQL_LITE_DB_PATH'] || DEFAULT_DB_PATH);
    },

    read: async (id: string): Promise<Threads> => {
      await ensureInitialized();

      const row = get<{
        id: string;
        appId: string | null;
        messages: string | null;
        userId: string | null;
      }>('SELECT id, appId, messages, userId FROM threads WHERE id = ?', [id]);

      if (!row) {
        throw new Error(`Thread not found for id ${id}`);
      }

      const thread: Threads = {
        id: row.id,
        appId: row.appId ?? undefined,
        messages: row.messages ?? undefined,
        userId: row.userId ?? undefined,
      };

      return thread;
    },

    listAll: async (): Promise<Threads[]> => {
      await ensureInitialized();

      const stmt = db.prepare(
        'SELECT id, appId, messages, userId FROM threads ORDER BY updated_at DESC',
      );
      const results: Threads[] = [];

      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: row.id as string,
          appId: (row.appId as string) ?? undefined,
          messages: (row.messages as string) ?? undefined,
          userId: (row.userId as string) ?? undefined,
        });
      }

      stmt.free();
      return results;
    },
  };
}
