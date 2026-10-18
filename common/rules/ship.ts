/**
 * Ship rules — the full rule, not just the check half.
 *
 * Ships live on water vertices (coast = 1 land hex, sea = 0). They move
 * stepwise along adjacent water vertices during the Action phase, spending
 * `turnState.shipSteps[shipId]` — set by the server when the Action phase
 * opens to `shipStepsForTurn(roll)`. Troops embark from an adjacent land
 * vertex and ride the ship (`aboardShipId`); disembarking lands them on a
 * coast vertex the ship touches (its own or an adjacent one). A loaded ship answers only
 * to its owner; an empty ship belongs to whoever moves it.
 */
import type { Board, EdgeId, VertexId } from '../types/Board';
import type { BuildCheck, RollResult } from '../types/Logic';
import type { Player } from '../types/Player';
import type { GameRoom } from '../types/Room';
import type { ShipObj } from '../types/Board';
import type { SoldierObj } from '../types/Pieces';
import { ShipPrice, ShipSettlePrice, MAX_SETTLEMENTS } from '../Constant';
import { canAfford } from '../utils/logic';
import { subtractPrice } from '../utils/trade';
import { rollTotal } from '../utils/dice';
import { playerSettlementVertexIds } from '../utils/placement';
import {
  adjacentVertexIds,
  coastVertexReachable,
  isCoastVertex,
  isWaterVertex,
} from '../utils/water';

const pass: BuildCheck = { allowed: true, reason: null };
const fail = (reason: string): BuildCheck => ({ allowed: false, reason });

/** Steps a ship gets this Action phase: half the dice total, rounded up. */
export function shipStepsForTurn(roll: RollResult): number {
  return Math.ceil(rollTotal(roll.die1 ?? 0, roll.die2 ?? 0) / 2);
}

/** Soldiers embarked on the given ship. */
export function troopsAboard(board: Board, shipId: string): SoldierObj[] {
  return Object.values(board.soldiers).filter((s) => s.aboardShipId === shipId);
}

/** Is there a ship standing on this vertex? (One ship per vertex.) */
export function shipAt(board: Board, vertexId: VertexId): ShipObj | null {
  return Object.values(board.ships).find((s) => s.vertexId === vertexId) ?? null;
}

/**
 * Build check: Build phase, your turn, a coast vertex (touches exactly one
 * land hex) that one of your roads or settlements touches, free of ships and
 * settlements, and you can pay 1 wood + 1 sheep.
 */
export function canBuildShip(room: GameRoom, player: Player, vertexId: VertexId): BuildCheck {
  if (!room.shipsEnabled) return fail('Ships are disabled in this game');
  const turn = room.turnState;
  if (turn.player !== player.name) return fail('Not your turn');
  if (turn.phase !== 'Build') return fail('Ships can only be built in the Build phase');
  const board = room.board;
  const vertex = board?.vertices[vertexId];
  if (!board || !vertex) return fail('Vertex not found');
  if (!isCoastVertex(board, vertexId)) return fail('Ships are built on coast vertices');
  if (vertex.settlementId !== null) return fail('A settlement already stands there');
  if (shipAt(board, vertexId)) return fail('A ship already occupies that vertex');
  if (!coastVertexReachable(board, vertexId, player.name))
    return fail('The coast vertex must touch one of your roads or settlements');
  if (!canAfford(player.resources, ShipPrice))
    return fail('Not enough resources for a ship (1 wood, 1 sheep)');
  return pass;
}

export function applyBuildShip(
  room: GameRoom,
  player: Player,
  vertexId: VertexId,
  shipId: string
): void {
  player.resources = subtractPrice(player.resources, ShipPrice);
  room.board!.ships[shipId] = { id: shipId, vertexId, ownerId: player.name };
  room.turnState.undoLog.push({ kind: 'buildShip', shipId });
}

/**
 * Move check: Action phase, your turn; the ship steps to an adjacent water
 * vertex with no other ship on it and has a step left this phase. A loaded
 * ship moves only for its owner; an empty ship may be moved by anyone (and
 * changes hands).
 */
export function canMoveShip(room: GameRoom, player: Player, shipId: string, vertexId: VertexId): BuildCheck {
  if (!room.shipsEnabled) return fail('Ships are disabled in this game');
  const turn = room.turnState;
  if (turn.player !== player.name) return fail('Not your turn');
  if (turn.phase !== 'Action') return fail('Ships can only move in the Action phase');
  const board = room.board;
  const ship = board?.ships[shipId];
  if (!board || !ship) return fail('Ship not found');
  const crew = troopsAboard(board, shipId);
  if (crew.length > 0 && ship.ownerId !== player.name)
    return fail('Only the owner can move a crewed ship');
  if ((turn.shipSteps[shipId] ?? 0) <= 0) return fail('This ship has no movement left this phase');
  if (!board.vertices[vertexId]) return fail('Vertex not found');
  if (!isWaterVertex(board, vertexId)) return fail('Ships can only sail to sea or coast vertices');
  if (!adjacentVertexIds(board, ship.vertexId).includes(vertexId))
    return fail('Ships move one adjacent vertex at a time');
  if (shipAt(board, vertexId)) return fail('A ship already occupies that vertex');
  return pass;
}

export function applyMoveShip(room: GameRoom, player: Player, shipId: string, vertexId: VertexId): void {
  const board = room.board!;
  const ship = board.ships[shipId];
  const troopMoves = troopsAboard(board, shipId).map((s) => ({
    soldierId: s.id,
    originalVertexId: s.vertexId,
  }));
  room.turnState.undoLog.push({
    kind: 'moveShip',
    shipId,
    originalVertexId: ship.vertexId,
    originalOwnerId: ship.ownerId,
    troopMoves,
  });
  ship.vertexId = vertexId;
  ship.ownerId = player.name; // an empty ship changes hands; the owner's stays
  for (const m of troopMoves) board.soldiers[m.soldierId].vertexId = vertexId;
  room.turnState.shipSteps[shipId] = (room.turnState.shipSteps[shipId] ?? 0) - 1;
}

/**
 * Embark check: Action phase; one of your soldiers (action still free)
 * standing on a vertex adjacent to the ship's vertex boards it.
 */
export function canEmbarkSoldier(
  room: GameRoom,
  player: Player,
  soldierId: string,
  shipId: string
): BuildCheck {
  if (!room.shipsEnabled) return fail('Ships are disabled in this game');
  const turn = room.turnState;
  if (turn.player !== player.name) return fail('Not your turn');
  if (turn.phase !== 'Action') return fail('Soldiers can only act in the Action phase');
  const board = room.board;
  const soldier = board?.soldiers[soldierId];
  if (!board || !soldier) return fail('Soldier not found');
  if (soldier.owner !== player.name) return fail('You can only command your own soldiers');
  if (turn.soldiersActedThisTurn.includes(soldierId))
    return fail('This soldier already used its action this phase');
  if (turn.soldiersCreatedThisTurn.includes(soldierId))
    return fail('A freshly built soldier cannot act this turn');
  if (turn.soldiersHealedThisTurn.includes(soldierId))
    return fail('A freshly healed soldier cannot act this turn');
  if (soldier.aboardShipId !== null) return fail('This soldier is already aboard a ship');
  if (soldier.type === 'cannon' && soldier.stationed)
    return fail('A stationed cannon must be unstationed before moving');
  const ship = board.ships[shipId];
  if (!ship) return fail('Ship not found');
  if (!adjacentVertexIds(board, ship.vertexId).includes(soldier.vertexId))
    return fail('The soldier must stand on a vertex adjacent to the ship');
  return pass;
}

export function applyEmbarkSoldier(
  room: GameRoom,
  _player: Player,
  soldierId: string,
  shipId: string
): void {
  const board = room.board!;
  const soldier = board.soldiers[soldierId];
  const ship = board.ships[shipId];
  room.turnState.undoLog.push({
    kind: 'embarkSoldier',
    soldierId,
    originalVertexId: soldier.vertexId,
  });
  soldier.vertexId = ship.vertexId;
  soldier.aboardShipId = shipId;
  soldier.stationed = false; // leaving a garrison clears the flag
  room.turnState.soldiersActedThisTurn.push(soldierId);
}

/**
 * Disembark check: Action phase; your aboard soldier lands on a coast vertex
 * the ship touches — its own coast vertex or an adjacent coast vertex — that
 * holds no settlement (enemy troops are fine; combat is separate). A ship
 * with no coast vertex in reach (open sea) can't unload.
 */
export function canDisembarkSoldier(
  room: GameRoom,
  player: Player,
  soldierId: string,
  vertexId: VertexId
): BuildCheck {
  if (!room.shipsEnabled) return fail('Ships are disabled in this game');
  const turn = room.turnState;
  if (turn.player !== player.name) return fail('Not your turn');
  if (turn.phase !== 'Action') return fail('Soldiers can only act in the Action phase');
  const board = room.board;
  const soldier = board?.soldiers[soldierId];
  if (!board || !soldier) return fail('Soldier not found');
  if (soldier.owner !== player.name) return fail('You can only command your own soldiers');
  if (turn.soldiersActedThisTurn.includes(soldierId))
    return fail('This soldier already used its action this phase');
  if (soldier.aboardShipId === null) return fail('This soldier is not aboard a ship');
  if (soldier.type === 'cannon' && soldier.stationed)
    return fail('A stationed cannon must be unstationed before moving');
  const ship = board.ships[soldier.aboardShipId];
  if (!ship) return fail('Ship not found');
  const vertex = board.vertices[vertexId];
  if (!vertex) return fail('Vertex not found');
  if (!isCoastVertex(board, vertexId)) return fail('Soldiers can only land on coast vertices');
  if (vertexId !== ship.vertexId && !adjacentVertexIds(board, ship.vertexId).includes(vertexId))
    return fail('Soldiers land on the ship’s vertex or one adjacent to it');
  if (vertex.settlementId !== null) return fail('A settlement already stands there');
  return pass;
}

export function applyDisembarkSoldier(
  room: GameRoom,
  _player: Player,
  soldierId: string,
  vertexId: VertexId
): void {
  const soldier = room.board!.soldiers[soldierId];
  const shipId = soldier.aboardShipId!;
  room.turnState.undoLog.push({ kind: 'disembarkSoldier', soldierId, shipId });
  soldier.vertexId = vertexId;
  soldier.aboardShipId = null;
  soldier.stationed = false;
  room.turnState.soldiersActedThisTurn.push(soldierId);
}

/**
 * Convert check: Build phase, your turn, your ship on or next to the target;
 * the target must be a coast vertex eligible for a settlement (distance rule,
 * empty, no ship, below the settlement cap), and you pay 1 wheat + 1 ore.
 */
export function canConvertShipToSettlement(
  room: GameRoom,
  player: Player,
  shipId: string,
  vertexId: VertexId
): BuildCheck {
  if (!room.shipsEnabled) return fail('Ships are disabled in this game');
  const turn = room.turnState;
  if (turn.player !== player.name) return fail('Not your turn');
  if (turn.phase !== 'Build') return fail('Ships can only settle in the Build phase');
  const board = room.board;
  const ship = board?.ships[shipId];
  if (!board || !ship) return fail('Ship not found');
  if (ship.ownerId !== player.name) return fail('You can only settle your own ship');
  const vertex = board.vertices[vertexId];
  if (!vertex) return fail('Vertex not found');
  if (!isCoastVertex(board, vertexId)) return fail('Ships settle on coast vertices');
  if (vertexId !== ship.vertexId && !adjacentVertexIds(board, ship.vertexId).includes(vertexId))
    return fail('The ship must be on or next to that coast vertex');
  if (vertex.settlementId !== null) return fail('Vertex already occupied');
  if (shipAt(board, vertexId)) return fail('A ship occupies that vertex');
  if (playerSettlementVertexIds(board, player.name).length >= MAX_SETTLEMENTS)
    return fail(`You already have the maximum ${MAX_SETTLEMENTS} settlements (including cities)`);
  const hasAdjacentSettlement = vertex.roadIds.some((edgeId: EdgeId) => {
    const edge = board.edges[edgeId];
    if (!edge) return false;
    const other = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
    return board.vertices[other]?.settlementId !== null;
  });
  if (hasAdjacentSettlement) return fail('Too close to an existing settlement');
  if (!canAfford(player.resources, ShipSettlePrice))
    return fail('Not enough resources (1 wheat, 1 ore)');
  return pass;
}

/**
 * Apply the conversion: the ship becomes a settlement on the coast vertex and
 * its embarked troops disembark onto it for free (no garrison spawns).
 */
export function applyConvertShipToSettlement(
  room: GameRoom,
  player: Player,
  shipId: string,
  vertexId: VertexId,
  settlementId: string
): void {
  const board = room.board!;
  player.resources = subtractPrice(player.resources, ShipSettlePrice);
  const shipVertexId = board.ships[shipId].vertexId;
  const troopIds = troopsAboard(board, shipId).map((s) => s.id);
  const stationedTroopIds = troopIds.filter((id) => board.soldiers[id].stationed);
  for (const id of troopIds) {
    const s = board.soldiers[id];
    s.vertexId = vertexId;
    s.aboardShipId = null;
    s.stationed = false;
  }
  delete board.ships[shipId];
  board.settlements[settlementId] = {
    id: settlementId,
    vertexId,
    ownerId: player.name,
    level: 'settlement',
    builtAt: Date.now(),
  };
  board.vertices[vertexId].settlementId = settlementId;
  room.turnState.undoLog.push({
    kind: 'convertShipToSettlement',
    shipId,
    settlementId,
    vertexId,
    troopIds,
    stationedTroopIds,
    shipVertexId,
  });
}
