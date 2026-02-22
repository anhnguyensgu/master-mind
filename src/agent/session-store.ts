import { Database } from 'bun:sqlite';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'node:fs';

const DB_DIR = join(homedir(), '.master-mind');
const DB_PATH = join(DB_DIR, 'conversations.db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_message_session_id ON message(session_id);
  CREATE INDEX IF NOT EXISTS idx_session_updated_at ON session(updated_at DESC);
`;

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messageCount: number;
}

export interface SessionStore {
  createSession(provider: string, model: string): string;
  saveMessage(sessionId: string, role: 'user' | 'assistant', content: string): void;
  getMessages(sessionId: string): SessionMessage[];
  getMostRecentSessionId(): string | null;
  listSessions(limit?: number): SessionInfo[];
  updateSessionTitle(sessionId: string, title: string): void;
  close(): void;
}

export function createSessionStore(dbPath: string = DB_PATH): SessionStore {
  mkdirSync(dbPath === DB_PATH ? DB_DIR : join(dbPath, '..'), { recursive: true });

  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);

  const insertSession = db.prepare<void, [string, string, string]>(
    'INSERT INTO session (id, provider, model) VALUES (?, ?, ?)'
  );

  const insertMessage = db.prepare<void, [string, string, string]>(
    'INSERT INTO message (session_id, role, content) VALUES (?, ?, ?)'
  );

  const touchSession = db.prepare<void, [string]>(
    "UPDATE session SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?"
  );

  const selectMessages = db.prepare<{ role: string; content: string }, [string]>(
    'SELECT role, content FROM message WHERE session_id = ? ORDER BY id ASC'
  );

  const selectMostRecent = db.prepare<{ id: string }, []>(
    'SELECT id FROM session ORDER BY updated_at DESC, rowid DESC LIMIT 1'
  );

  const selectSessions = db.prepare<
    { id: string; title: string; created_at: string; updated_at: string; provider: string; model: string; message_count: number },
    [number]
  >(
    `SELECT s.id, s.title, s.created_at, s.updated_at, s.provider, s.model,
            (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) as message_count
     FROM session s
     ORDER BY s.updated_at DESC, s.rowid DESC
     LIMIT ?`
  );

  const updateTitle = db.prepare<void, [string, string]>(
    'UPDATE session SET title = ? WHERE id = ?'
  );

  return {
    createSession(provider: string, model: string): string {
      const id = crypto.randomUUID();
      insertSession.run(id, provider, model);
      return id;
    },

    saveMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
      insertMessage.run(sessionId, role, content);
      touchSession.run(sessionId);
    },

    getMessages(sessionId: string): SessionMessage[] {
      const rows = selectMessages.all(sessionId);
      return rows.map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
      }));
    },

    getMostRecentSessionId(): string | null {
      const row = selectMostRecent.get();
      return row?.id ?? null;
    },

    listSessions(limit = 10): SessionInfo[] {
      const rows = selectSessions.all(limit);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        provider: row.provider,
        model: row.model,
        messageCount: row.message_count,
      }));
    },

    updateSessionTitle(sessionId: string, title: string): void {
      updateTitle.run(title, sessionId);
    },

    close(): void {
      db.close();
    },
  };
}
