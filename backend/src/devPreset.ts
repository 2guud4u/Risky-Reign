import { Board, DevelopmentCardType, GameRoom, SoldierObj, isCoastVertex, isLandVertex, validSettlementVertices } from 'common';

/**
 * Dev-mode preset board: skip the SetUp phase and start round 1 with cities,
 * settlements, roads, soldiers and development cards already in place, laid
 * out so every soldier action and card can be exercised right away. Gated
 * like `STARTING_RESOURCES`: on unless `NODE_ENV=production`; `DEV_PRESET=0`
 * turns it off, `DEV_PRESET=1` forces it on.
 */
const envPreset = process.env.DEV_PRESET;
export const DEV_PRESET =
  envPreset === '1' ? true : envPreset === '0' ? false : process.env.NODE_ENV !== 'production';

/** Playable cards handed to every player (Victory Point is counted on draw, never held). */
const PRESET_HAND: DevelopmentCardType[] = ['knight', 'road_building', 'year_of_plenty', 'monopoly'];

/** Battle wins pre-credited to player A: one more win earns Conqueror. */
const PRESET_A_BATTLES_WON = 2;

let devId = 0;
const nextId = (prefix: string) => `dev_${prefix}_${++devId}`;

interface SoldierOpts {
  injured?: boolean;
  type?: SoldierObj['type'];
  stationed?: boolean;
  aboardShipId?: string | null;
}

function addSoldiers(board: Board, owner: string, vertexId: string, count: number, opts: SoldierOpts = {}): void {
  for (let i = 0; i < count; i++) {
    const id = nextId('soldier');
    const soldier: SoldierObj = {
      id,
      owner,
      injured: opts.injured ?? false,
      vertexId,
      type: opts.type ?? 'infantry',
      stationed: opts.stationed ?? true,
      aboardShipId: opts.aboardShipId ?? null,
    };
    board.soldiers[id] = soldier;
  }
}

function addShip(board: Board, owner: string, vertexId: string): string {
  const id = nextId('ship');
  board.ships[id] = { id, vertexId, ownerId: owner };
  return id;
}

/** The road (if any) on the edge connecting two vertices. */
function roadBetween(board: Board, vertexAId: string, vertexBId: string) {
  const edge = Object.values(board.edges).find(
    (e) =>
      (e.vertexAId === vertexAId && e.vertexBId === vertexBId) ||
      (e.vertexAId === vertexBId && e.vertexBId === vertexAId),
  );
  return edge?.roadId ? board.roads[edge.roadId] : null;
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
    board.roads[id] = { id, edgeId, ownerId: owner, builtAt: Date.now(), isWall: false };
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
 * Hand every player one of each playable development card (immediately
 * playable) and credit one Victory Point card, taking the cards out of the
 * shared deck so its count stays honest.
 */
function dealDevCards(room: GameRoom): void {
  const take = (card: DevelopmentCardType) => {
    const i = room.devCardDeck.indexOf(card);
    if (i >= 0) room.devCardDeck.splice(i, 1);
  };
  for (const p of room.players) {
    p.developmentCards = [...PRESET_HAND];
    p.devCardsBoughtThisTurn = 0;
    for (const card of PRESET_HAND) take(card);
    p.victoryPoints += 1;
    take('victory_point');
  }
}

/**
 * Apply the preset to a room that has just started.
 *
 * Every player: a city (2 soldiers) and a settlement (1 soldier), each with a
 * road, plus one of each development card and 1 VP from a Victory Point card.
 *
 * Scenarios, each on its own vertex (A = first player, B = second, C = third):
 *  - Contested road end: 3 A vs 2 B on A's city road end — a plain 1-round
 *    attack (or move along the road).
 *  - Big battle: 5 A vs 4 B — multi-round, reserves beyond MAX_PER_ROUND.
 *  - Injured fight: 2 A vs 2 injured B — attacking injured troops (the roll-off).
 *  - Three-way: 2 A, 2 B, 2 C on one vertex — the attack picker lists two names.
 *  - Capture: B's settlement ungarrisoned with 1 A soldier on it.
 *  - Blocked capture: 1 A soldier on B's (garrisoned) city — capture is greyed,
 *    attack is offered.
 *  - Robber: 1 A soldier on a corner of the robber's hex.
 *  - Heal: 2 injured A soldiers on A's city.
 *  - Counter-attack for B's turn: 3 B vs 2 A on B's city road end.
 *  - Conqueror: A starts with 2 battle wins; one more win claims it.
 *
 * New pieces (each staged only when the room flag is on):
 *  - Cannons: unstationed A cannon on A's city (station/fire from scratch),
 *    stationed A cannon on A's contested road end (in range of B's troops),
 *    stationed B cannon on B's city (fires back during B's turn; A's
 *    blocked-capture soldier is in range for it).
 *  - Walls: B's city->road-end edge is walled (A's soldier on the city can
 *    open the wall gate; B's troops see it from their side). A's settlement
 *    road is walled (own-wall free passage; capture flood-fill stops there).
 *  - Ships: A's ship on a coast vertex near A's settlement carrying 2 troops
 *    plus a stationed cannon (naval artillery). B's empty ship on another
 *    coast vertex — anyone may sail it.
 *
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
    addSoldiers(board, name, cityVertex, 2);

    const settlementVertex = pickSettlementVertex(board, robberHexId);
    if (!settlementVertex) continue;
    addSettlement(board, name, settlementVertex, 'settlement');
    settlements[name] = settlementVertex;
    addRoadFrom(board, name, settlementVertex);
  }

  const [a, b, c] = names;
  // Every settlement gets its usual garrison — except B's, the capture target.
  for (const name of names) {
    const v = settlements[name];
    if (v && name !== b) addSoldiers(board, name, v, 1);
  }

  // Free battleground vertices: on land (soldiers on foot never stand at
  // sea), no building, not a road end, off the robber's hex. Deterministic
  // order; each scenario takes the next one.
  const reserved = new Set(Object.values(roadEnds).filter((v): v is string => !!v));
  const pool = Object.values(board.vertices)
    .filter(
      (v) =>
        isLandVertex(board, v.id) &&
        !v.settlementId &&
        !reserved.has(v.id) &&
        (!robberHexId || !v.hexIds.includes(robberHexId))
    )
    .map((v) => v.id)
    .sort();
  const nextSpot = () => pool.shift() ?? null;

  if (a) {
    if (cities[a]) addSoldiers(board, a, cities[a], 2, { injured: true }); // heal
    if (robberHexId) {
      const robberVertex = Object.values(board.vertices).find(
        (v) => v.hexIds.includes(robberHexId) && !v.settlementId
      );
      if (robberVertex) addSoldiers(board, a, robberVertex.id, 1); // robber fight
    }
    room.battlesWon[a] = PRESET_A_BATTLES_WON; // conqueror
  }
  if (a && b) {
    const contested = roadEnds[a];
    if (contested) {
      addSoldiers(board, a, contested, 3);
      addSoldiers(board, b, contested, 2);
    }
    const big = nextSpot();
    if (big) {
      addSoldiers(board, a, big, 5);
      addSoldiers(board, b, big, 4);
    }
    const injuredFight = nextSpot();
    if (injuredFight) {
      addSoldiers(board, a, injuredFight, 2);
      addSoldiers(board, b, injuredFight, 2, { injured: true });
    }
    if (settlements[b]) addSoldiers(board, a, settlements[b], 1); // capture
    if (cities[b]) addSoldiers(board, a, cities[b], 1); // blocked capture
    const counter = roadEnds[b];
    if (counter) {
      addSoldiers(board, b, counter, 3);
      addSoldiers(board, a, counter, 2);
    }
  }
  if (a && b && c) {
    const threeWay = nextSpot();
    if (threeWay) {
      addSoldiers(board, a, threeWay, 2);
      addSoldiers(board, b, threeWay, 2);
      addSoldiers(board, c, threeWay, 2);
    }
  }

  // ── New-piece scenarios (cannons / walls / ships) ───────────────────────
  // Each respects the room's piece toggles so a disabled piece simply isn't
  // staged.

  if (room.cannonsEnabled && a && cities[a]) {
    // Cannon on A's city: unstationed, ready to station then fire.
    addSoldiers(board, a, cities[a], 1, { type: 'cannon', stationed: false });
    // A second cannon already stationed on the contested road end (in range
    // of B's troops there) plus a fresh infantry so the upgrade flow is
    // exercisable on A's city too.
    if (roadEnds[a]) {
      addSoldiers(board, a, roadEnds[a], 1, { type: 'cannon', stationed: true });
    }
  }
  if (room.cannonsEnabled && b && cities[b]) {
    // Stationed B cannon next to B's city — A's blocked-capture soldier can be
    // targeted by it, and B can fire during its own Action phase.
    addSoldiers(board, b, cities[b], 1, { type: 'cannon', stationed: true });
  }

  if (room.wallsEnabled && a && b) {
    // Wall on B's road out of its city: A's blocked-capture soldier on the
    // city can attempt the wall gate out, and B's counter-attack troops see
    // it. The wall edge = B's city -> B's road end.
    const wallRoad = roadEnds[b] ? roadBetween(board, cities[b], roadEnds[b]) : null;
    if (wallRoad) wallRoad.isWall = true;
    // Wall on A's settlement road: exercises own-wall free passage and the
    // capture flood-fill stopping at walls.
    const settleRoad =
      settlements[a] &&
      Object.values(board.roads).find(
        (r) =>
          r.ownerId === a &&
          board.edges[r.edgeId] &&
          (board.edges[r.edgeId].vertexAId === settlements[a] ||
            board.edges[r.edgeId].vertexBId === settlements[a]),
      );
    if (settleRoad) settleRoad.isWall = true;
  }

  if (room.shipsEnabled && a && b) {
    // A's ship on a coast vertex near A's settlement with troops + a stationed
    // cannon aboard (naval artillery), plus an empty B ship anyone can sail.
    const coasts = Object.values(board.vertices).filter(
      (v) => isCoastVertex(board, v.id) && !v.settlementId,
    );
    const edgesTouching = (vid: string) =>
      Object.values(board.edges).filter((e) => e.vertexAId === vid || e.vertexBId === vid);
    const near = (vid: string, origin: string) =>
      edgesTouching(origin).some((e) => (e.vertexAId === origin ? e.vertexBId : e.vertexAId) === vid);

    // Prefer a coast vertex adjacent to A's settlement's road end so embarked
    // troops and settle-conversion both make sense.
    const aShipSpot =
      (settlements[a] &&
        coasts.find((v) => near(v.id, settlements[a]))) ||
      (roadEnds[a] && coasts.find((v) => near(v.id, roadEnds[a]!))) ||
      coasts[0];
    if (aShipSpot) {
      const shipId = addShip(board, a, aShipSpot.id);
      // Two embarked troops (move with the ship, can't walk) + a cannon that
      // can station aboard and fire one intersection from the ship.
      addSoldiers(board, a, aShipSpot.id, 2, { aboardShipId: shipId, stationed: false });
      if (room.cannonsEnabled) {
        addSoldiers(board, a, aShipSpot.id, 1, {
          type: 'cannon',
          stationed: true,
          aboardShipId: shipId,
        });
      }
      // B's empty ship on a different coast vertex — anyone may commandeer it.
      const bSpot = coasts.find((v) => v.id !== aShipSpot.id && !near(v.id, aShipSpot.id));
      if (bSpot) addShip(board, b, bSpot.id);
    }
  }

  dealDevCards(room);

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
    shipSteps: {},
    undoLog: [],
  };
  room.roll = { die1: null, die2: null };
  console.log(`[dev preset] applied to room ${room.id} (${names.length} players)`);
}
