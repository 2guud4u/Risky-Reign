import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Single SQLite connection for persisted games, per the persistence plan:
 * `node:sqlite` (no new dependency), WAL + FULL sync for durability. One table
 * (`games`) holding one JSON snapshot per room plus the columns the server
 * queries/authorizes on before loading (status, host, passwords, version,
 * timestamps). Schema is versioned via `PRAGMA user_version`; migrations run
 * in order at open.
 *
 * `DATA_DIR` env var points at the directory holding `games.db`. Default
 * `./data` in dev; `/data` in the container (a volume mount on the host). We
 * resolve lazily so tests can set the env var before first use.
 */

const MIGRATIONS: readonly string[] = [
  // migration 1 — persisted games, one snapshot per room
  `CREATE TABLE games (
    id                  TEXT PRIMARY KEY,          -- room code (the link stays the same)
    status              TEXT NOT NULL CHECK (status IN ('playing','paused','resuming','finished')),
    host_name           TEXT NOT NULL,             -- seat name of the host
    host_password_hash  TEXT,                      -- scrypt; set by the host when pausing (NULL for autosaved live games)
    lobby_password_hash TEXT,                      -- scrypt; set at "Start Lobby Again", NULL while paused
    state_version       INTEGER NOT NULL,          -- snapshot shape version (starts at 1)
    state_json          TEXT NOT NULL,             -- serialized GameRoom snapshot
    version             INTEGER NOT NULL DEFAULT 1,-- optimistic lock, +1 on every write
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    last_activity_at    INTEGER NOT NULL,
    paused_at           INTEGER,
    resumed_at          INTEGER,
    completed_at        INTEGER
  );
  CREATE INDEX games_last_activity ON games(last_activity_at);`,
];

let db: DatabaseSync | null = null;

/** Directory that holds games.db: `DATA_DIR` env, else `<cwd>/data`. */
export function dataDir(): string {
  return resolve(process.env.DATA_DIR ?? './data');
}

/** Open (and migrate) the database. Idempotent — subsequent calls return it. */
export function getDb(): DatabaseSync {
  if (db) return db;
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const conn = new DatabaseSync(resolve(dir, 'games.db'));
  conn.exec('PRAGMA journal_mode = WAL');
  conn.exec('PRAGMA synchronous = FULL');
  conn.exec('PRAGMA foreign_keys = ON');
  runMigrations(conn);
  db = conn;
  return conn;
}

/** Apply pending numbered migrations, tracking progress in `user_version`. */
function runMigrations(conn: DatabaseSync): void {
  const { user_version: version } = conn
    .prepare('PRAGMA user_version')
    .get() as { user_version: number };
  for (let i = version; i < MIGRATIONS.length; i++) {
    conn.exec('BEGIN');
    try {
      conn.exec(MIGRATIONS[i]);
      conn.exec(`PRAGMA user_version = ${i + 1}`);
      conn.exec('COMMIT');
    } catch (err) {
      conn.exec('ROLLBACK');
      throw err;
    }
  }
}

/** Close the connection (tests and graceful shutdown). */
export function closeDb(): void {
  db?.close();
  db = null;
}
