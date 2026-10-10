import { GameRoom } from 'common';
import { getDb } from './db';
import { SNAPSHOT_VERSION, deserialize, serialize } from './gameSnapshot';

/**
 * The only module that talks SQL. Everything is parameterized; rows map to a
 * typed `GameRow`/`GameMeta` so callers never see column names. Optimistic
 * locking: every mutating call that must not clobber a newer write takes the
 * `version` the caller read and includes it in the WHERE clause — a stale
 * writer gets `changes = 0` and the lifecycle layer retries or rejects.
 *
 * `status` lives on the row (not inside the snapshot) so the server can
 * authorize (host check, "is this game resumable?") without loading state.
 */

export type PersistedStatus = 'playing' | 'paused' | 'resuming' | 'finished';

interface GameRow {
  id: string;
  status: string;
  host_name: string;
  host_password_hash: string | null;
  lobby_password_hash: string | null;
  state_version: number;
  state_json: string;
  version: number;
  created_at: number;
  updated_at: number;
  last_activity_at: number;
  paused_at: number | null;
  resumed_at: number | null;
  completed_at: number | null;
}

/** Row metadata, minus the (large) state payload — for auth/listing queries. */
export interface GameMeta extends Omit<GameRow, 'state_json' | 'state_version'> {}

/** Extra columns a caller may set alongside the snapshot on insert/update.
 *  Optional fields are preserve-on-undefined: autosave omits them and the
 *  upsert keeps the existing value (COALESCE) instead of wiping it. */
export interface PersistFields {
  status: PersistedStatus;
  hostName: string;
  /** Omitted on autosave; set only when the host pauses the game. */
  hostPasswordHash?: string;
  lobbyPasswordHash?: string | null;
  pausedAt?: number | null;
  resumedAt?: number | null;
  completedAt?: number | null;
}

function toMeta(r: GameRow): GameMeta {
  const { state_json: _j, state_version: _v, ...meta } = r;
  return meta;
}

/** Insert or overwrite the snapshot + status fields for `room` (used by pause/autosave). */
export function saveSnapshot(room: GameRoom, fields: PersistFields, expectedVersion?: number): boolean {
  const now = Date.now();
  const stateJson = serialize(room);
  const db = getDb();
  if (expectedVersion === undefined) {
    db.prepare(
      `INSERT INTO games (id, status, host_name, host_password_hash, lobby_password_hash,
        state_version, state_json, version, created_at, updated_at, last_activity_at,
        paused_at, resumed_at, completed_at)
       VALUES (?,?,?,?,?,?,?,1,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, host_name=excluded.host_name,
        host_password_hash=COALESCE(excluded.host_password_hash, games.host_password_hash),
        lobby_password_hash=COALESCE(excluded.lobby_password_hash, games.lobby_password_hash),
        state_version=excluded.state_version, state_json=excluded.state_json,
        version=games.version+1, updated_at=excluded.updated_at,
        last_activity_at=excluded.last_activity_at,
        paused_at=COALESCE(excluded.paused_at, games.paused_at),
        resumed_at=COALESCE(excluded.resumed_at, games.resumed_at),
        completed_at=COALESCE(excluded.completed_at, games.completed_at)`,
    ).run(
      room.id, fields.status, fields.hostName, fields.hostPasswordHash ?? null,
      fields.lobbyPasswordHash ?? null, SNAPSHOT_VERSION, stateJson,
      now, now, now,
      fields.pausedAt ?? null, fields.resumedAt ?? null, fields.completedAt ?? null,
    );
    return true;
  }
  // Optimistic update: only when the row is still at the version we saw.
  const res = db.prepare(
    `UPDATE games SET status=?, host_name=?,
      host_password_hash=COALESCE(?, host_password_hash),
      lobby_password_hash=COALESCE(?, lobby_password_hash),
      state_version=?, state_json=?, version=version+1, updated_at=?, last_activity_at=?,
      paused_at=COALESCE(?, paused_at), resumed_at=COALESCE(?, resumed_at), completed_at=COALESCE(?, completed_at)
     WHERE id=? AND version=?`,
  ).run(
    fields.status, fields.hostName, fields.hostPasswordHash ?? null, fields.lobbyPasswordHash ?? null,
    SNAPSHOT_VERSION, stateJson, now, now,
    fields.pausedAt ?? null, fields.resumedAt ?? null, fields.completedAt ?? null,
    room.id, expectedVersion,
  );
  return res.changes > 0;
}


/** Load the full snapshot back into a live GameRoom (null if absent/corrupt). */
export function load(id: string): GameRoom | null {
  const row = getDb()
    .prepare('SELECT state_json, state_version FROM games WHERE id = ?')
    .get(id) as Pick<GameRow, 'state_json' | 'state_version'> | undefined;
  if (!row) return null;
  try {
    return deserialize(id, row.state_json, row.state_version);
  } catch {
    return null;
  }
}

/** Status/host/passwords/version for authorization — never loads the snapshot. */
export function getMeta(id: string): GameMeta | null {
  const row = getDb()
    .prepare(`SELECT id, status, host_name, host_password_hash, lobby_password_hash,
        version, created_at, updated_at, last_activity_at, paused_at, resumed_at, completed_at
      FROM games WHERE id = ?`)
    .get(id) as Omit<GameRow, 'state_json' | 'state_version'> | undefined;
  return row ? toMeta({ ...row, state_json: '', state_version: 0 }) : null;
}

/** Transition `status` (and optional timestamp/lobby-hash) if the version still matches. */
export function updateStatus(
  id: string,
  status: PersistedStatus,
  expectedVersion: number,
  fields: Partial<Pick<PersistFields, 'lobbyPasswordHash' | 'pausedAt' | 'resumedAt' | 'completedAt'>> = {},
): boolean {
  const res = getDb()
    .prepare(
      `UPDATE games SET status=?, version=version+1, updated_at=?,
        lobby_password_hash=COALESCE(?, lobby_password_hash),
        paused_at=COALESCE(?, paused_at), resumed_at=COALESCE(?, resumed_at),
        completed_at=COALESCE(?, completed_at)
       WHERE id=? AND version=?`,
    )
    .run(
      status, Date.now(),
      fields.lobbyPasswordHash ?? null,
      fields.pausedAt ?? null, fields.resumedAt ?? null, fields.completedAt ?? null,
      id, expectedVersion,
    );
  return res.changes > 0;
}

/** Record meaningful activity (drives the 7-day expiry sweep). */
export function touchActivity(id: string, at: number): void {
  getDb()
    .prepare('UPDATE games SET last_activity_at=? WHERE id=?')
    .run(at, id);
}

/** Delete rows with no activity since `cutoff` (ms epoch). Returns removed ids. */
export function deleteExpired(cutoff: number): string[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id FROM games WHERE last_activity_at < ?')
    .all(cutoff) as Pick<GameRow, 'id'>[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM games WHERE id IN (${placeholders})`).run(...ids);
  return ids;
}

/** Delete a single game row (e.g. "Play Again" resets to a fresh lobby). */
export function remove(id: string): void {
  getDb().prepare('DELETE FROM games WHERE id=?').run(id);
}
