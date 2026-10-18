import {
  Board,
  GameRoom,
  HexId,
  Player,
  PublicGameRoom,
  SoldierObj,
  TurnState,
  VertexId,
  adjacentVertexIds,
  canKnightSpawnAt,
  canMoveRobberAdjacent,
  canMoveShip,
  canPlaceRobberOn,
  isWaterVertex,
  shipAt,
} from 'common';

/**
 * The board's "who can do what right now" answers, derived once here so the
 * map layers, drag resolvers and action bubbles all agree. Pure functions
 * over the broadcast room/board — every rule delegates to the authoritative
 * `common` validators (or the same turn-state flags they read); nothing
 * re-derives game rules inline.
 *
 * Two soldier predicates, kept deliberately distinct:
 * - `soldierCanAct` — the soldier still has its one action this phase. A
 *   freshly healed soldier CAN still act (healing blocks moves, not
 *   actions — Rule 25 / canHealSoldierAt).
 * - `soldierMovable` — can act AND is allowed to move: not freshly healed
 *   and not a stationed cannon (Rule 49: unstation before moving). This is
 *   the eligibility half of `canMoveSoldierTo`; use it for drag/pick gates.
 */

/** Whether a soldier still has its one action to spend this phase. */
export function soldierCanAct(soldier: SoldierObj, turn: TurnState | undefined): boolean {
  if (!turn) return false;
  return (
    !turn.soldiersActedThisTurn.includes(soldier.id) &&
    !turn.soldiersCreatedThisTurn.includes(soldier.id)
  );
}

/** Whether a soldier may move this turn (the eligibility half of `canMoveSoldierTo`). */
export function soldierMovable(soldier: SoldierObj, room: PublicGameRoom): boolean {
  return (
    soldierCanAct(soldier, room.turnState) &&
    !room.turnState.soldiersHealedThisTurn.includes(soldier.id) &&
    !(soldier.type === 'cannon' && soldier.stationed) &&
    // Embarked troops ride the ship — they leave only via disembarkSoldier.
    soldier.aboardShipId === null
  );
}

/**
 * The player's soldiers that can be picked for an action right now: only on
 * their own Action phase with no battle running. Board-wide when `vertexId`
 * is omitted, restricted to a vertex when given. Drives the pickable
 * soldiers and the energy-bolt highlight on the map.
 */
export function actableSoldierIds(
  room: PublicGameRoom | null,
  playerName: string | undefined,
  vertexId?: string | null
): string[] {
  if (!room?.board || !playerName) return [];
  const turn = room.turnState;
  if (turn.phase !== 'Action' || turn.player !== playerName || room.battleState) return [];
  return Object.values(room.board.soldiers ?? {})
    .filter(
      (s) =>
        (vertexId === undefined || vertexId === null || s.vertexId === vertexId) &&
        s.owner === playerName &&
        soldierCanAct(s, turn)
    )
    .map((s) => s.id);
}

/**
 * The player's soldiers that may still move this Action phase: own turn,
 * `soldierMovable` each (freshly healed soldiers and stationed cannons are
 * excluded — the rules `canMoveSoldierTo` enforces on the backend). Mirrors
 * the drag-eligibility gate, so the bolted set can contain soldiers this
 * set doesn't (a healed soldier may still act but not move).
 */
export function movableSoldierIds(
  room: PublicGameRoom | null,
  playerName: string | undefined,
  vertexId?: string | null
): string[] {
  if (!room?.board || !playerName) return [];
  const turn = room.turnState;
  if (turn.phase !== 'Action' || turn.player !== playerName) return [];
  return Object.values(room.board.soldiers ?? {})
    .filter(
      (s) =>
        (vertexId === undefined || vertexId === null || s.vertexId === vertexId) &&
        s.owner === playerName &&
        soldierMovable(s, room)
    )
    .map((s) => s.id);
}

/**
 * Whether the badge/sprite for `ownerName`'s soldiers at `vertexId` may be
 * grabbed by `playerName`: own Action phase, own troops, and at least one
 * soldier there is still movable.
 */
export function isSoldierDraggable(
  room: PublicGameRoom | null,
  playerName: string | undefined,
  ownerName: string,
  vertexId: VertexId
): boolean {
  if (playerName !== ownerName) return false;
  return movableSoldierIds(room, playerName, vertexId).length > 0;
}

/** The first movable soldier this owner has at the vertex (the drag pick). */
export function movableSoldierAt(
  room: PublicGameRoom | null,
  ownerName: string,
  vertexId: VertexId
): SoldierObj | null {
  if (!room?.board) return null;
  return (
    Object.values(room.board.soldiers).find(
      (s) => s.vertexId === vertexId && s.owner === ownerName && soldierMovable(s, room)
    ) ?? null
  );
}

/**
 * Vertices a soldier leaving `vertexId` may be dropped on: the far end of
 * every road-connected edge (soldiers move along roads — `canMoveSoldierTo`
 * rejects anything else).
 */
export function soldierMoveTargets(board: Board, vertexId: VertexId): VertexId[] {
  const vertex = board.vertices[vertexId];
  if (!vertex) return [];
  const targets: VertexId[] = [];
  for (const edgeId of vertex.roadIds) {
    const edge = board.edges[edgeId];
    if (!edge || edge.roadId === null) continue; // no road on this edge
    targets.push(edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId);
  }
  return targets;
}

/**
 * BFS paths a ship may sail this Action phase: each reachable water vertex
 * (sea or coast, no other ship) within `shipSteps` single-vertex hops, mapped
 * to the hop list that gets it there — `moveShip` steps one adjacent vertex
 * per call, so a sail is emitted hop-by-hop. Mirrors `canMoveShip`.
 */
export function sailPaths(
  room: PublicGameRoom,
  playerName: string,
  shipId: string
): Map<VertexId, VertexId[]> {
  const out = new Map<VertexId, VertexId[]>();
  const board = room.board;
  const ship = board?.ships[shipId];
  if (!board || !ship) return out;
  const steps = room.turnState?.shipSteps?.[shipId] ?? 0;
  if (steps <= 0) return out;
  // The rule checks want the full GameRoom/Player; the public room + name
  // carry every field the ship rules read.
  const asRoom = room as unknown as GameRoom;
  const asPlayer = { name: playerName } as Player;
  let frontier = new Map<VertexId, VertexId[]>([[ship.vertexId, []]]);
  const seen = new Set<VertexId>([ship.vertexId]);
  for (let depth = 1; depth <= steps && frontier.size > 0; depth++) {
    const next = new Map<VertexId, VertexId[]>();
    for (const [at, path] of frontier) {
      for (const to of adjacentVertexIds(board, at)) {
        if (seen.has(to) || !isWaterVertex(board, to) || shipAt(board, to)) continue;
        if (!canMoveShip(asRoom, asPlayer, shipId, to).allowed) continue;
        seen.add(to);
        const extended = [...path, to];
        next.set(to, extended);
        out.set(to, extended);
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * Hexes the robber may be moved to after it is defeated in a fight:
 * adjacent to `fromHexId` and not the desert (`canMoveRobberAdjacent` is the
 * authoritative rule the backend applies to `moveRobberAfterWin`).
 */
export function robberTargets(board: Board, fromHexId: HexId): HexId[] {
  return Object.keys(board.hexes).filter(
    (hexId) => canMoveRobberAdjacent(board, fromHexId, hexId).allowed
  );
}

/**
 * Hexes a pending robber placement (a 7 roll or a played knight) may land
 * on: anything that isn't the desert or the hex it already sits on
 * (`canPlaceRobberOn` is the authoritative rule).
 */
export function robberPlacementTargets(board: Board): HexId[] {
  return Object.keys(board.hexes).filter((hexId) => canPlaceRobberOn(board, hexId).allowed);
}

/**
 * Vertices a played knight card may spawn a soldier on: wherever the player
 * already has a soldier (`canKnightSpawnAt` is the authoritative rule).
 */
export function knightSpawnTargets(board: Board, playerName: string): VertexId[] {
  return Object.keys(board.vertices).filter(
    (vertexId) => canKnightSpawnAt(board, playerName, vertexId).allowed
  );
}
