import { GameRoom, GameStatus, PausedGameInfo, PERSISTED_GAME_TTL_MS } from 'common';
import { gameRooms } from './store';
import {
  GameMeta,
  PersistedStatus,
  getMeta,
  load,
  saveSnapshot,
  updateStatus,
} from './persistence/gameRepository';

/**
 * Room lifecycle: transitions between in-memory and persisted states.
 *
 *   waiting → playing → paused → resuming → playing → finished
 *                     └────────── autosave keeps a 'playing' row current ──┘
 *
 * 'waiting' rooms are memory-only. Everything else has a DB row once it has
 * been autosaved or paused. The row is the restart-survival copy (Option A):
 * a server restart leaves players disconnected but the room code still
 * resolves — the next joinRoom/spectate hydrates the snapshot back.
 */

/** Allowed status edges; anything else is a caller bug or a stale request. */
const ALLOWED: Record<GameStatus, readonly GameStatus[]> = {
  waiting: ['playing'],
  playing: ['paused', 'finished'],
  paused: ['resuming'],
  resuming: ['playing', 'paused'],
  finished: [],
};

/**
 * Lobby password hashes for 'resuming' rooms, server-side only — never on the
 * GameRoom (it would leak through snapshots/broadcasts). Keyed by room id.
 */
const resumeLobbyHashes = new Map<string, string>();
export const resumeLobbyHash = (roomId: string): string | undefined => resumeLobbyHashes.get(roomId);
export const setResumeLobbyHash = (roomId: string, hash: string): void => {
  resumeLobbyHashes.set(roomId, hash);
};
export const clearResumeLobbyHash = (roomId: string): void => {
  resumeLobbyHashes.delete(roomId);
};

const hostNameOf = (room: GameRoom): string => room.players[0]?.name ?? '';

/** In-memory status → row status (identical today; kept as the one mapping). */
const persistedStatus = (status: GameStatus): PersistedStatus =>
  status === 'waiting' ? 'playing' : status;

/**
 * Autosave: persist the current in-memory state. Called from broadcastRoom on
 * every state emission so a restart loses at most the in-flight action.
 * Waiting lobbies are never persisted; optional hash/timestamp columns are
 * preserved by the upsert (autosave never overwrites pause data).
 */
export function autosaveRoom(room: GameRoom): void {
  if (room.gameStatus === 'waiting') return;
  saveSnapshot(room, {
    status: persistedStatus(room.gameStatus),
    hostName: hostNameOf(room),
    pausedAt: room.pausedAt,
    completedAt: room.gameStatus === 'finished' ? Date.now() : null,
  });
}

/**
 * Flip `room.gameStatus` and persist the transition. Returns an error string
 * for illegal edges so handlers can surface it. `fields` carries the extra
 * columns the transition sets (pause: host + lobby hashes; resume lobby:
 * resumedAt; finish: completedAt).
 */
export function transition(
  room: GameRoom,
  to: GameStatus,
  fields: { hostPasswordHash?: string; lobbyPasswordHash?: string | null } = {},
): string | null {
  const from = room.gameStatus;
  if (!ALLOWED[from].includes(to)) {
    return `Cannot go from ${from} to ${to}`;
  }
  const now = Date.now();
  room.gameStatus = to;
  if (to === 'paused') {
    room.pausedAt = now;
    saveSnapshot(room, {
      status: 'paused',
      hostName: hostNameOf(room),
      hostPasswordHash: fields.hostPasswordHash,
      lobbyPasswordHash: fields.lobbyPasswordHash,
      pausedAt: now,
    });
  } else if (to === 'resuming') {
    saveSnapshot(room, {
      status: 'resuming',
      hostName: hostNameOf(room),
      resumedAt: now,
    });
  } else if (to === 'finished') {
    saveSnapshot(room, {
      status: 'finished',
      hostName: hostNameOf(room),
      completedAt: now,
    });
  } else if (from === 'resuming' && to === 'playing') {
    // Lobby complete: fresh autosave, drop the in-memory lobby hash.
    saveSnapshot(room, { status: 'playing', hostName: hostNameOf(room) });
    clearResumeLobbyHash(room.id);
  }
  return null;
}

/**
 * Hydrate a persisted row back into `gameRooms`. Returns the live room, or
 * null when the row is absent/corrupt — or (without `allowPaused`) when the
 * row is 'paused': paused rooms stay cold until a host reopens them. On
 * success the lobby hash (if any) is restored so seat claims keep working
 * across restarts.
 */
export function hydrateRoom(id: string, opts: { allowPaused?: boolean } = {}): GameRoom | null {
  const existing = gameRooms.get(id);
  if (existing) return existing;
  const meta = getMeta(id);
  if (!meta) return null;
  if (meta.status === 'paused' && !opts.allowPaused) return null;
  const room = load(id);
  if (!room) return null;
  // Hydrated rooms arrive fully disconnected; the row's clock survives so the
  // expiry sweep and expiresAt stay continuous across restarts.
  room.lastActivityAt = meta.last_activity_at;
  gameRooms.set(id, room);
  if (meta.status === 'resuming' && meta.lobby_password_hash) {
    resumeLobbyHashes.set(id, meta.lobby_password_hash);
  }
  return room;
}

/** Persisted-room lookup for join paths that only need metadata. */
export const persistedMeta = (id: string): GameMeta | null => getMeta(id);

/** ms timestamp at which a persisted row expires. */
export const expiresAtOf = (meta: GameMeta): number => meta.last_activity_at + PERSISTED_GAME_TTL_MS;

/**
 * Build the `pausedGameInfo` payload for a paused row (players read from the
 * snapshot, room stays cold) or a live 'resuming' room (players read from
 * memory, `connected` reflects who's back).
 */
export function pausedInfo(
  roomId: string,
  meta: GameMeta,
  room?: GameRoom,
): PausedGameInfo {
  const source = room ?? load(roomId);
  return {
    roomId,
    status: meta.status === 'resuming' ? 'resuming' : 'paused',
    players: (source?.players ?? []).map((p) => ({
      name: p.name,
      color: p.color,
      connected: room ? p.connected : false,
    })),
    pausedAt: meta.paused_at,
    expiresAt: expiresAtOf(meta),
    requiresLobbyPassword: meta.status === 'resuming' && !!meta.lobby_password_hash,
  };
}

/**
 * A 'resuming' lobby that went idle closes back to 'paused' (same as the
 * host hitting "Close"), so the lobby password stops accepting claims. The
 * lobby hash itself stays on the row — the same password reopens it.
 */
export function closeResumingRoom(room: GameRoom): void {
  const meta = getMeta(room.id);
  if (meta) updateStatus(room.id, 'paused', meta.version);
  clearResumeLobbyHash(room.id);
  room.gameStatus = 'paused';
}
