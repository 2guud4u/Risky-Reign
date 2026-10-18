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

export const SNAPSHOT_VERSION = 3;

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
    // Settings saved before they existed: none (an undefined cap would let
    // every setup placement be a city). The turn timer likewise defaults
    // off; a stale deadline must never carry over a resume.
    setupCities: snap.setupCities ?? 0,
    turnTimerMs: snap.turnTimerMs ?? 0,
    // Snapshots written before the lock existed are unlocked.
    rulesLocked: snap.rulesLocked ?? false,
    phaseTimerEndsAt: null,
    // v1 → v2: cannons/walls/ships joined the rules; old rows get the
    // feature flags on and every new field defaulted.
    cannonsEnabled: snap.cannonsEnabled ?? true,
    wallsEnabled: snap.wallsEnabled ?? true,
    shipsEnabled: snap.shipsEnabled ?? true,
    wallGate: snap.wallGate ?? null,
    cannonShot: snap.cannonShot ?? null,
    phaseTimerRemainingMs: null,
    // Snapshots written before room passwords existed are open rooms.
    passwordHash: snap.passwordHash ?? null,
    bonuses: {
      ...snap.bonuses,
      // Snapshots written before the rename still carry hasWarmonger.
      hasConqueror:
        snap.bonuses?.hasConqueror ??
        (snap.bonuses as { hasWarmonger?: Record<string, boolean> } | undefined)?.hasWarmonger ??
        {},
    },
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
 * Upgrade a stored snapshot from `fromVersion` to `SNAPSHOT_VERSION`.
 * v1 → v2 adds the pieces layer: roads gain `isWall`, the board gains
 * `ships`, soldiers gain `aboardShipId`, the turn gains `shipSteps`, and the
 * room gains the three feature flags + `wallGate`.
 * v2 → v3 reshapes undo entries (cannon shots became final; boarding, ship
 * moves and wall crossings record different fields), so a saved undo log is
 * dropped — it only ever covers the current phase. It also strips road ids
 * that the old road builder pushed into `vertex.roadIds`, which holds the
 * board's edge ids.
 */
export function migrate(snapshot: unknown, fromVersion: number): GameSnapshot {
  if (fromVersion === SNAPSHOT_VERSION) return snapshot as GameSnapshot;
  const snap = snapshot as GameSnapshot;
  if (fromVersion <= 1) {
    for (const road of Object.values(snap.board?.roads ?? {})) {
      road.isWall ??= false;
    }
    if (snap.board) snap.board.ships ??= {};
    for (const soldier of Object.values(snap.board?.soldiers ?? {})) {
      soldier.aboardShipId ??= null;
    }
    if (snap.turnState) snap.turnState.shipSteps ??= {};
    snap.cannonsEnabled ??= true;
    snap.wallsEnabled ??= true;
    snap.shipsEnabled ??= true;
    snap.wallGate ??= null;
    if (snap.wallGate) snap.wallGate.roll ??= null;
    snap.cannonShot ??= null;
  }
  if (fromVersion <= 2) {
    if (snap.turnState) snap.turnState.undoLog = [];
    const board = snap.board;
    if (board) {
      for (const vertex of Object.values(board.vertices)) {
        vertex.roadIds = vertex.roadIds.filter((id) => !!board.edges[id]);
      }
    }
  }
  return snap;
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
