/**
 * Cannon rules — the full rule, not just the check half.
 *
 * A cannon is a `SoldierObj` with `type: 'cannon'`; its `stationed` flag is
 * the emplaced marker (a stationed cannon can attack but cannot move — same
 * immobile semantics as infantry's garrisoned-at-spawn flag). Every cannon
 * action costs the soldier's action for the phase.
 *
 * Attacks measure range from the cannon's effective vertex — when the cannon
 * is embarked, that is its ship's vertex. All dice are rolled server-side and
 * handed to the apply (never generated inside common) so results are
 * broadcast-able and replay-able.
 */
import type { Board, EdgeId, VertexId } from '../types/Board';
import type { BuildCheck } from '../types/Logic';
import type { SoldierObj } from '../types/Pieces';
import type { Player } from '../types/Player';
import type { GameRoom } from '../types/Room';
import { CannonUpgradePrice, CANNON_WALL_HIT } from '../Constant';
import { canAfford } from '../utils/logic';
import { subtractPrice } from '../utils/trade';
import { verticesAdjacent } from '../utils/water';

const pass: BuildCheck = { allowed: true, reason: null };
const fail = (reason: string): BuildCheck => ({ allowed: false, reason });

/** The vertex a cannon fires from: its ship's vertex when embarked. */
export function cannonVertexId(board: Board, soldier: SoldierObj): VertexId {
  if (soldier.aboardShipId) {
    const ship = board.ships[soldier.aboardShipId];
    if (ship) return ship.vertexId;
  }
  return soldier.vertexId;
}

/** Shared gate: your turn, your soldier, its action still free. */
function soldierActionGate(
  room: GameRoom,
  player: Player,
  soldierId: string
): { check: BuildCheck; soldier: SoldierObj | null } {
  const turn = room.turnState;
  if (turn.player !== player.name) return { check: fail('Not your turn'), soldier: null };
  if (turn.phase !== 'Action')
    return { check: fail('Soldiers can only act in the Action phase'), soldier: null };
  const soldier = room.board?.soldiers[soldierId] ?? null;
  if (!soldier) return { check: fail('Soldier not found'), soldier: null };
  if (soldier.owner !== player.name)
    return { check: fail('You can only command your own soldiers'), soldier: null };
  if (turn.soldiersActedThisTurn.includes(soldierId))
    return { check: fail('This soldier already used its action this phase'), soldier: null };
  if (turn.soldiersCreatedThisTurn.includes(soldierId))
    return { check: fail('A freshly built soldier cannot act this turn'), soldier: null };
  if (turn.soldiersHealedThisTurn.includes(soldierId))
    return { check: fail('A freshly healed soldier cannot act this turn'), soldier: null };
  return { check: pass, soldier };
}

function cannonGate(
  room: GameRoom,
  player: Player,
  soldierId: string
): { check: BuildCheck; soldier: SoldierObj | null } {
  if (!room.cannonsEnabled)
    return { check: fail('Cannons are disabled in this game'), soldier: null };
  const gate = soldierActionGate(room, player, soldierId);
  if (!gate.check.allowed || !gate.soldier) return gate;
  if (gate.soldier.type !== 'cannon') return { check: fail('This soldier is not a cannon'), soldier: null };
  return gate;
}

function stationedCannonGate(
  room: GameRoom,
  player: Player,
  soldierId: string
): { check: BuildCheck; soldier: SoldierObj | null } {
  const gate = cannonGate(room, player, soldierId);
  if (!gate.check.allowed || !gate.soldier) return gate;
  if (!gate.soldier.stationed)
    return { check: fail('The cannon must be stationed before it can attack'), soldier: null };
  return gate;
}

/**
 * Upgrade check (Rules: cannons): Action phase, your turn, one of your
 * infantry standing on a settlement/city you own, and you can pay
 * 1 wood + 1 ore. Costs the soldier's action.
 */
export function canUpgradeCannon(room: GameRoom, player: Player, soldierId: string): BuildCheck {
  if (!room.cannonsEnabled) return fail('Cannons are disabled in this game');
  const gate = soldierActionGate(room, player, soldierId);
  if (!gate.check.allowed || !gate.soldier || !room.board) return gate.check;
  const soldier = gate.soldier;
  if (soldier.type === 'cannon') return fail('This soldier is already a cannon');
  if (soldier.injured) return fail('Heal this soldier before upgrading it to a cannon');
  if (soldier.aboardShipId !== null)
    return fail('A soldier aboard a ship cannot be upgraded — disembark first');
  const settlementId = room.board.vertices[soldier.vertexId]?.settlementId;
  const settlement = settlementId ? room.board.settlements[settlementId] : undefined;
  if (!settlement || settlement.ownerId !== player.name)
    return fail('Only a soldier standing on your settlement or city can become a cannon');
  if (!canAfford(player.resources, CannonUpgradePrice))
    return fail('Not enough resources for a cannon upgrade (1 wood, 1 ore)');
  return pass;
}

export function applyUpgradeCannon(room: GameRoom, player: Player, soldierId: string): void {
  const soldier = room.board!.soldiers[soldierId];
  const wasStationed = soldier.stationed;
  player.resources = subtractPrice(player.resources, CannonUpgradePrice);
  soldier.type = 'cannon';
  // Rules: a new cannon starts unstationed (the infantry garrison flag drops).
  soldier.stationed = false;
  room.turnState.soldiersActedThisTurn.push(soldierId);
  room.turnState.undoLog.push({ kind: 'upgradeCannon', soldierId, wasStationed });
}

/** Downgrade check: your cannon, anywhere, costs its action. */
export function canDowngradeCannon(room: GameRoom, player: Player, soldierId: string): BuildCheck {
  return cannonGate(room, player, soldierId).check;
}

export function applyDowngradeCannon(room: GameRoom, player: Player, soldierId: string): void {
  const soldier = room.board!.soldiers[soldierId];
  const wasStationed = soldier.stationed;
  soldier.type = 'infantry';
  // The emplaced flag is a cannon concept; a downgraded soldier stands ready.
  soldier.stationed = false;
  room.turnState.soldiersActedThisTurn.push(soldierId);
  room.turnState.undoLog.push({ kind: 'downgradeCannon', soldierId, wasStationed });
}

/** Station check: your unstationed cannon, anywhere (aboard a ship counts). */
export function canStationCannon(room: GameRoom, player: Player, soldierId: string): BuildCheck {
  const gate = cannonGate(room, player, soldierId);
  if (!gate.check.allowed || !gate.soldier) return gate.check;
  if (gate.soldier.stationed) return fail('This cannon is already stationed');
  return pass;
}

export function applyStationCannon(room: GameRoom, _player: Player, soldierId: string): void {
  room.board!.soldiers[soldierId].stationed = true;
  room.turnState.soldiersActedThisTurn.push(soldierId);
  room.turnState.undoLog.push({ kind: 'stationCannon', soldierId });
}

/** Unstation check: your stationed cannon. */
export function canUnstationCannon(room: GameRoom, player: Player, soldierId: string): BuildCheck {
  const gate = cannonGate(room, player, soldierId);
  if (!gate.check.allowed || !gate.soldier) return gate.check;
  if (!gate.soldier.stationed) return fail('This cannon is not stationed');
  return pass;
}

export function applyUnstationCannon(room: GameRoom, _player: Player, soldierId: string): void {
  room.board!.soldiers[soldierId].stationed = false;
  room.turnState.soldiersActedThisTurn.push(soldierId);
  room.turnState.undoLog.push({ kind: 'unstationCannon', soldierId });
}

/**
 * Ranged-attack check: stationed cannon; the target is an enemy soldier
 * exactly one intersection (one edge) away from the cannon's effective vertex.
 */
export function canCannonAttack(
  room: GameRoom,
  player: Player,
  soldierId: string,
  targetSoldierId: string
): BuildCheck {
  const gate = stationedCannonGate(room, player, soldierId);
  if (!gate.check.allowed || !gate.soldier || !room.board) return gate.check;
  const target = room.board.soldiers[targetSoldierId];
  if (!target) return fail('Target soldier not found');
  if (target.owner === player.name) return fail('You cannot fire on your own soldiers');
  if (!verticesAdjacent(room.board, cannonVertexId(room.board, gate.soldier), target.vertexId))
    return fail('Target must be exactly one intersection away');
  return pass;
}
/** How long a resolved single-target shot lingers so everyone sees the outcome. */
export const CANNON_SHOT_REVEAL_MS = 3000;

/** The rolled outcome of a single cannon shot. */
export interface CannonAttackResult {
  cannonRoll: number;
  targetRoll: number;
  /** 'miss' = defender rolled higher; otherwise the target's fate. */
  outcome: 'kill' | 'injure' | 'miss';
}

/**
 * Apply a ranged shot: cannon die vs target die, cannon wins ties. A win by
 * >=2 kills the target, by 1 injures it (target cannons die instead — they
 * can never be injured). The cannon itself is never hurt. Assumes the check
 * passed; the caller supplies both d6 rolls.
 */
export function applyCannonAttack(
  room: GameRoom,
  _player: Player,
  soldierId: string,
  targetSoldierId: string,
  cannonRoll: number,
  targetRoll: number
): CannonAttackResult {
  const board = room.board!;
  const target = board.soldiers[targetSoldierId];
  let outcome: CannonAttackResult['outcome'] = 'miss';
  if (cannonRoll >= targetRoll) {
    // Cannon wins ties. Win by >=2 kills outright, otherwise injures —
    // except cannons, which die on any loss.
    if (cannonRoll - targetRoll >= 2 || target.type === 'cannon') {
      delete board.soldiers[targetSoldierId];
      outcome = 'kill';
    } else {
      target.injured = true;
      outcome = 'injure';
    }
  }
  room.turnState.soldiersActedThisTurn.push(soldierId);
  // A shot is final (GLOSSARY "Cannon"): its dice are public, so neither it
  // nor anything before it this phase can be undone.
  room.turnState.undoLog = [];
  // Record the shot so every client can show the duel panel; it self-clears
  // after CANNON_SHOT_REVEAL_MS via the cannon-shot reveal timer.
  room.cannonShot = {
    cannonId: soldierId,
    shooterName: _player.name,
    targetSoldierId,
    targetOwnerName: target.owner,
    vertexId: target.vertexId,
    cannonRoll,
    targetRoll,
    outcome,
    chained: false,
    targetType: target.type,
  };
  return { cannonRoll, targetRoll, outcome };
}

/**
 * Splash check: stationed cannon; the target vertex is the cannon's own
 * vertex or exactly one intersection away, holds at least one soldier other
 * than the cannon, and you pay 1 ore for the shot.
 */
export function canCannonSplash(
  room: GameRoom,
  player: Player,
  soldierId: string,
  vertexId: VertexId
): BuildCheck {
  const gate = stationedCannonGate(room, player, soldierId);
  if (!gate.check.allowed || !gate.soldier || !room.board) return gate.check;
  const from = cannonVertexId(room.board, gate.soldier);
  if (vertexId !== from && !verticesAdjacent(room.board, from, vertexId))
    return fail('Target must be this vertex or one intersection away');
  if (!Object.values(room.board.soldiers).some((s) => s.vertexId === vertexId && s.id !== soldierId))
    return fail('No soldiers on that vertex');
  if (!canAfford(player.resources, { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 1 }))
    return fail('Not enough ore for a splash shot');
  return pass;
}

/** The rolled outcome of a splash: the cannon's die plus each victim's fate. */
export interface CannonSplashResult {
  cannonRoll: number;
  kills: string[];
  injured: string[];
}

/**
 * Apply a splash: pay 1 ore; every soldier on the target vertex pairs its own
 * roll against the cannon's single roll (cannon wins ties); margin casualties
 * hit victims only — the cannon takes nothing. `victimRolls` maps each victim
 * soldier id to its server-rolled d6.
 */
export function applyCannonSplash(
  room: GameRoom,
  player: Player,
  soldierId: string,
  vertexId: VertexId,
  cannonRoll: number,
  victimRolls: Record<string, number>
): CannonSplashResult {
  const board = room.board!;
  player.resources = subtractPrice(player.resources, {
    Wood: 0,
    Brick: 0,
    Sheep: 0,
    Wheat: 0,
    Ore: 1,
  });
  const injured: string[] = [];
  const kills: string[] = [];
  for (const victim of Object.values(board.soldiers)) {
    if (victim.vertexId !== vertexId || victim.id === soldierId) continue;
    const roll = victimRolls[victim.id] ?? 0;
    if (cannonRoll < roll) continue;
    if (cannonRoll - roll >= 2 || victim.type === 'cannon') {
      kills.push(victim.id);
      delete board.soldiers[victim.id];
    } else {
      if (!victim.injured) injured.push(victim.id);
      victim.injured = true;
    }
  }
  room.turnState.soldiersActedThisTurn.push(soldierId);
  // A shot is final: neither it nor anything before it can be undone.
  room.turnState.undoLog = [];
  return { cannonRoll, kills, injured };
}

/**
 * Wall-attack check: stationed cannon adjacent to a walled edge (the wall's
 * edge touches the cannon's effective vertex).
 */
export function canCannonAttackWall(
  room: GameRoom,
  player: Player,
  soldierId: string,
  edgeId: EdgeId
): BuildCheck {
  const gate = stationedCannonGate(room, player, soldierId);
  if (!gate.check.allowed || !gate.soldier || !room.board) return gate.check;
  const edge = room.board.edges[edgeId];
  if (!edge) return fail('Edge not found');
  const road = edge.roadId ? room.board.roads[edge.roadId] : undefined;
  if (!road?.isWall) return fail('There is no wall on that edge');
  const from = cannonVertexId(room.board, gate.soldier);
  if (edge.vertexAId !== from && edge.vertexBId !== from)
    return fail('The cannon must be adjacent to the wall');
  return pass;
}

/**
 * Apply a wall shot: a roll of CANNON_WALL_HIT or higher reverts the wall to
 * a normal road; a lower roll does nothing. Either way the cannon's action is
 * spent.
 */
export function applyCannonAttackWall(
  room: GameRoom,
  _player: Player,
  soldierId: string,
  edgeId: EdgeId,
  roll: number
): { roll: number; breached: boolean } {
  const edge = room.board!.edges[edgeId];
  const road = edge?.roadId ? room.board!.roads[edge.roadId] : undefined;
  const breached = !!road && roll >= CANNON_WALL_HIT;
  if (breached) road!.isWall = false;
  room.turnState.soldiersActedThisTurn.push(soldierId);
  // A wall shot is final: neither it nor anything before it can be undone.
  room.turnState.undoLog = [];
  return { roll, breached };
}
