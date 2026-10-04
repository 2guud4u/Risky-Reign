import { Board, GameRoom, SoldierObj, validSettlementVertices } from 'common';

/**
 * Dev-mode preset board: skip the SetUp phase and start round 1 with cities,
 * settlements, roads and soldiers already placed, laid out so every soldier
 * action can be exercised right away. Gated like `STARTING_RESOURCES`: on
 * unless `NODE_ENV=production`; `DEV_PRESET=0` turns it off, `DEV_PRESET=1`
 * forces it on.
 */
const envPreset = process.env.DEV_PRESET;
export const DEV_PRESET =
  envPreset === '1' ? true : envPreset === '0' ? false : process.env.NODE_ENV !== 'production';

/** Soldiers placed by the preset (beyond the garrisons that come with buildings). */
const CONTESTED_ATTACKERS = 3;
const CONTESTED_DEFENDERS = 2;

let devId = 0;
const nextId = (prefix: string) => `dev_${prefix}_${++devId}`;

function addSoldier(board: Board, owner: string, vertexId: string, injured = false): void {
  const id = nextId('soldier');
  const soldier: SoldierObj = { id, owner, injured, vertexId, type: 'infantry', stationed: true };
  board.soldiers[id] = soldier;
}

function addSettlement(board: Board, owner: string, vertexId: string, level: 'settlement' | 'city'): void {
  const id = nextId('settlement');
  board.settlements[id] = { id, vertexId, ownerId: owner, level, builtAt: Date.now() };
  board.vertices[vertexId].settlementId = id;
}

/** Build a road on the first free edge out of `vertexId`; returns the vertex at its far end. */
function addRoadFrom(board: Board, owner: string, vertexId: string): string | null {
  for (const edgeId of board.vertices[vertexId].roadIds) {
    const edge = board.edges[edgeId];
    if (!edge || edge.roadId !== null) continue;
    const id = nextId('road');
    board.roads[id] = { id, edgeId, ownerId: owner, builtAt: Date.now() };
    edge.roadId = id;
    for (const v of [edge.vertexAId, edge.vertexBId]) {
      if (!board.vertices[v].roadIds.includes(edgeId)) board.vertices[v].roadIds.push(edgeId);
    }
    return edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
  }
  return null;
}

/**
 * A legal settlement vertex (distance rule) that touches the most producing
 * land and stays clear of the robber's hex (that spot is reserved for the
 * robber-fight soldier). Deterministic: ties break by vertex id.
 */
function pickSettlementVertex(board: Board, robberHexId: string | undefined): string | null {
  const producing = (hexId: string) => {
    const t = board.hexes[hexId]?.terrain;
    return t !== undefined && t !== 'Water' && t !== 'Desert';
  };
  const candidates = validSettlementVertices(board)
    .map((id) => board.vertices[id])
    .filter((v) => !robberHexId || !v.hexIds.includes(robberHexId))
    .sort((a, b) => b.hexIds.filter(producing).length - a.hexIds.filter(producing).length || a.id.localeCompare(b.id));
  return candidates[0]?.id ?? null;
}

/**
 * Apply the preset to a room that has just started. Per player: a city and a
 * settlement, each with a road and its garrison (1 soldier per settlement,
 * 2 per city, like the build handlers). On top of that, for the first two
 * players (A, B):
 *  - Contested vertex (A's city road end): 3 of A's soldiers + 2 of B's →
 *    A can attack right away.
 *  - Capture target: B's settlement is ungarrisoned with 1 of A's soldiers
 *    on it → A can capture it.
 *  - Robber: 1 of A's soldiers on a vertex of the robber's hex → A can fight
 *    the robber.
 *  - Heal: 1 injured soldier of A's on A's city.
 * The turn starts at the first player's Dice phase (setup is skipped).
 */
export function applyDevPreset(room: GameRoom): void {
  const board = room.board;
  if (!board || room.players.length === 0) return;
  const names = room.players.map((p) => p.name);
  const robberHexId = Object.values(board.hexes).find((h) => h.robber)?.id;

  const cities: Record<string, string> = {};
  const settlements: Record<string, string> = {};
  const roadEnds: Record<string, string | null> = {};
  for (const name of names) {
    const cityVertex = pickSettlementVertex(board, robberHexId);
    if (!cityVertex) break;
    addSettlement(board, name, cityVertex, 'city');
    cities[name] = cityVertex;
    roadEnds[name] = addRoadFrom(board, name, cityVertex);
    addSoldier(board, name, cityVertex);
    addSoldier(board, name, cityVertex);

    const settlementVertex = pickSettlementVertex(board, robberHexId);
    if (!settlementVertex) continue;
    addSettlement(board, name, settlementVertex, 'settlement');
    settlements[name] = settlementVertex;
    addRoadFrom(board, name, settlementVertex);
  }

  const [a, b] = names;
  for (const name of names) {
    // Every settlement gets its usual garrison — except B's, the capture target.
    const v = settlements[name];
    if (v && name !== b) addSoldier(board, name, v);
  }
  if (a) {
    if (cities[a]) addSoldier(board, a, cities[a], true);
    if (robberHexId) {
      const robberVertex = Object.values(board.vertices).find(
        (v) => v.hexIds.includes(robberHexId) && !v.settlementId
      );
      if (robberVertex) addSoldier(board, a, robberVertex.id);
    }
  }
  if (a && b) {
    const contested = roadEnds[a];
    if (contested) {
      for (let i = 0; i < CONTESTED_ATTACKERS; i++) addSoldier(board, a, contested);
      for (let i = 0; i < CONTESTED_DEFENDERS; i++) addSoldier(board, b, contested);
    }
    if (settlements[b]) addSoldier(board, a, settlements[b]);
  }

  // Skip setup: the same state `advanceTurn` leaves after the last setup turn.
  room.turnState = {
    ...room.turnState,
    phase: 'Dice',
    player: room.turnState.playerOrder[0] ?? names[0],
    offset: 0,
    dicePlayerIndex: 0,
    placedSettlement: null,
    placedRoad: null,
    soldiersActedThisTurn: [],
    soldiersCreatedThisTurn: [],
    soldiersHealedThisTurn: [],
    robberFoughtThisPhase: [],
    undoLog: [],
  };
  room.roll = { die1: null, die2: null };
  console.log(`[dev preset] applied to room ${room.id} (${names.length} players)`);
}
