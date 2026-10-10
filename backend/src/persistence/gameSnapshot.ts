import { GameRoom, Player } from 'common';

/**
 * Serialize a `GameRoom` to its persistent snapshot and back. The snapshot is
 * the whole aggregate as JSON — we never query into it — minus the fields that
 * are runtime-only (socket ids, seat tokens, live `connected`, the in-memory
 * `spectators` list and `lastActivityAt`; the DB row carries its own
 * timestamps). Loading re-fills those fields so a resumed room is a valid
 * in-memory GameRoom with every seat offline until reclaimed.
 *
 * `state_version` tracks the snapshot *shape*: bump `SNAPSHOT_VERSION` and add
 * a `migrate` arm when a rules change alters what must be persisted.
 */

export const SNAPSHOT_VERSION = 1;

/** Persistent player: identity + game state + seat token (kept so a live
    socket's saved token still re-attaches after a server restart). Runtime
    seat/token fields that stay out: id, connected, and the masked counts. */
type SnapshotPlayer = Omit<Player, 'id' | 'connected' | 'resourceCount' | 'devCardCount'>;

/** The serializable slice of a GameRoom (everything except runtime fields). */
export interface GameSnapshot
  extends Omit<GameRoom, 'players' | 'spectators' | 'lastActivityAt' | 'id'> {
  players: SnapshotPlayer[];
}

/** Strip runtime-only fields so the room can be written to `state_json`. */
export function toSnapshot(room: GameRoom): GameSnapshot {
  const { id: _id, players, spectators: _s, lastActivityAt: _a, ...rest } = room;
  return {
    ...rest,
    players: players.map((p) => {
      const { id: _i, connected: _c, resourceCount: _r, devCardCount: _d, ...keep } = p;
      return keep;
    }),
  };
}

/**
 * Rebuild an in-memory `GameRoom` from a stored snapshot. Every seat starts
 * disconnected (fresh socket ids are issued on claim), and runtime fields are
 * reset.
 */
export function fromSnapshot(id: string, snap: GameSnapshot): GameRoom {
  return {
    ...snap,
    id,
    players: snap.players.map((p) => ({
      ...p,
      id: '',
      connected: false,
      // token survives in `p`: saved client tokens re-attach after restart.
    })),
    spectators: [],
    lastActivityAt: Date.now(),
  };
}

/**
 * Upgrade a stored snapshot from `fromVersion` to `SNAPSHOT_VERSION`. v1 is
 * the only shape so far, so this is the identity map — the hook exists so a
 * future rules change can rewrite old rows instead of rejecting them.
 */
export function migrate(snapshot: unknown, fromVersion: number): GameSnapshot {
  if (fromVersion === SNAPSHOT_VERSION) return snapshot as GameSnapshot;
  // No older versions exist yet. When SNAPSHOT_VERSION bumps, transform here.
  return snapshot as GameSnapshot;
}

/**
 * Structural check that a parsed snapshot has the fields a GameRoom needs.
 * Not a full validator — it guards against truncated/corrupt JSON at load so
 * the caller fails loudly instead of producing a half-room. Round-tripping
 * (toSnapshot → fromSnapshot) is exercised in tests.
 */
export function isSnapshot(value: unknown): value is GameSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.players) &&
    typeof v.turnState === 'object' &&
    v.turnState !== null &&
    typeof v.gameStatus === 'string' &&
    typeof v.pointsToWin === 'number'
  );
}

/** Serialize a room for storage. */
export function serialize(room: GameRoom): string {
  return JSON.stringify(toSnapshot(room));
}

/** Parse + migrate + hydrate a stored snapshot into a live room. */
export function deserialize(id: string, stateJson: string, stateVersion: number): GameRoom {
  const parsed = JSON.parse(stateJson) as unknown;
  const migrated = migrate(parsed, stateVersion);
  if (!isSnapshot(migrated)) throw new Error(`Corrupt snapshot for game ${id}`);
  return fromSnapshot(id, migrated);
}
