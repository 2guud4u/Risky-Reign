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
import { CannonUpgradePrice, ExplosiveShotPrice, CANNON_WALL_HIT, GREAT_WALL_HIT } from '../Constant';
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

/** The dice a player still owes on a pending ranged shot: the cannon's die
 *  (`soldierId: null`) plus one entry per victim of theirs. */
export function owedDice(
  shot: { kind?: 'duel'; shooterName: string; cannonRoll: number | null; victims: { soldierId: string; ownerName: string; roll: number | null }[] },
  playerName: string
): (string | null)[] {
  const owed: (string | null)[] = [];
  if (shot.shooterName === playerName && shot.cannonRoll === null) owed.push(null);
  for (const v of shot.victims) {
    if (v.ownerName === playerName && v.roll === null) owed.push(v.soldierId);
  }
  return owed;
}

/** Any player with at least one unrolled die on the pending shot. */
export function owedRollers(
  shot: { shooterName: string; cannonRoll: number | null; victims: { ownerName: string; roll: number | null }[] }
): Set<string> {
  const names = new Set<string>();
  if (shot.cannonRoll === null) names.add(shot.shooterName);
  for (const v of shot.victims) if (v.roll === null) names.add(v.ownerName);
  return names;
}

/**
 * Open a ranged shot: the cannon's action is spent and the shot is final
 * the moment it fires (undo log cleared). No dice roll yet — the record sits
 * with `cannonRoll: null` and every victim `roll: null`, freezing the board
 * like a battle until `rollCannonShot` fills them. `chained` marks the Chain
 * shot: its 1-ore cost is paid at fire and `victims` covers the whole vertex.
 */
export function applyFireRangedShot(
  room: GameRoom,
  player: Player,
  soldierId: string,
  victimIds: string[],
  vertexId: VertexId,
  chained: boolean
): void {
  const board = room.board!;
  room.turnState.soldiersActedThisTurn.push(soldierId);
  room.turnState.undoLog = [];
  if (chained) {
    player.resources = subtractPrice(player.resources, {
      Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 1,
    });
  }
  room.cannonShot = {
    kind: 'duel',
    cannonId: soldierId,
    shooterName: player.name,
    vertexId,
    cannonRoll: null,
    victims: victimIds.map((id) => {
      const s = board.soldiers[id]!;
      return { soldierId: id, ownerName: s.owner, type: s.type, roll: null, outcome: null };
    }),
    chained,
  };
}

/**
 * A die-roll check on the pending ranged shot: `soldierId` null picks the
 * cannon's die (shooter only), otherwise that victim's die (its owner only).
 */
export function canRollCannonShot(room: GameRoom, player: Player, soldierId: string | null): BuildCheck {
  const shot = room.cannonShot;
  if (!shot || shot.kind === 'wall') return fail('No ranged shot is in progress');
  if (soldierId === null) {
    if (shot.cannonRoll !== null) return fail('The cannon already rolled');
    if (shot.shooterName !== player.name) return fail('Only the shooter rolls the cannon die');
    return pass;
  }
  const victim = shot.victims.find((v) => v.soldierId === soldierId);
  if (!victim) return fail('That soldier is not part of this shot');
  if (victim.roll !== null) return fail('That soldier already rolled');
  if (victim.ownerName !== player.name) return fail('Only that soldier’s owner rolls its die');
  return pass;
}

/**
 * Apply one rolled die on the pending ranged shot (`soldierId` null = the
 * cannon's die). Once every die is in, outcomes apply: cannon wins ties, a
 * margin of >=2 kills, a lesser margin injures (victim cannons die on any
 * loss and are never injured). The shot then sits for the reveal timer.
 */
export function applyRollCannonShot(
  room: GameRoom,
  _player: Player,
  soldierId: string | null,
  roll: number
): void {
  const shot = room.cannonShot;
  if (!shot || shot.kind === 'wall') return;
  if (soldierId === null) shot.cannonRoll = roll;
  else {
    const victim = shot.victims.find((v) => v.soldierId === soldierId);
    if (victim) victim.roll = roll;
  }
  if (shot.cannonRoll === null || shot.victims.some((v) => v.roll === null)) return;
  // All dice in: resolve every victim's fate against the cannon's roll.
  const board = room.board!;
  for (const victim of shot.victims) {
    const margin = shot.cannonRoll - victim.roll!;
    victim.outcome = margin < 0 ? 'miss' : margin >= 2 || victim.type === 'cannon' ? 'kill' : 'injure';
    const soldier = board.soldiers[victim.soldierId];
    if (!soldier) continue;
    if (victim.outcome === 'kill') delete board.soldiers[victim.soldierId];
    else if (victim.outcome === 'injure') soldier.injured = true;
  }
}


/**
 * Wall-attack check: stationed cannon adjacent to a walled edge (the wall's
 * edge touches the cannon's effective vertex). `explosive` also requires 1
 * ore — the guaranteed breach (GLOSSARY "Explosive shot").
 */
export function canCannonAttackWall(
  room: GameRoom,
  player: Player,
  soldierId: string,
  edgeId: EdgeId,
  explosive = false
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
  if (explosive && !canAfford(player.resources, ExplosiveShotPrice))
    return fail('Not enough ore for an explosive shot');
  return pass;
}

/**
 * The die value a wall shot must reach to breach: CANNON_WALL_HIT normally,
 * GREAT_WALL_HIT while the wall's current owner holds The Great Wall —
 * capturing a holder's wall instantly drops it back to 4+.
 */
export function wallHitTarget(room: Pick<GameRoom, 'bonuses'>, road: { ownerId: string }): number {
  return room.bonuses?.hasGreatWall?.[road.ownerId] ? GREAT_WALL_HIT : CANNON_WALL_HIT;
}

/**
 * Open a wall shot. The cannon's action is spent and the shot is final the
 * moment it fires (undo log cleared — pending input is ceremony, not a
 * choice). A Single shot leaves `roll: null` on the record — the breach
 * itself lands in applyRollWallShot when the shooter clicks the die (or the
 * cannon-shot timer rolls for them). An Explosive shot pays 1 ore and
 * breaches on the spot — no die is ever rolled for it.
 */
export function applyFireWallShot(
  room: GameRoom,
  player: Player,
  soldierId: string,
  edgeId: EdgeId,
  explosive: boolean
): void {
  const edge = room.board!.edges[edgeId]!;
  const road = edge.roadId ? room.board!.roads[edge.roadId] : undefined;
  const threshold = road ? wallHitTarget(room, road) : CANNON_WALL_HIT;
  if (explosive) {
    player.resources = subtractPrice(player.resources, ExplosiveShotPrice);
    if (road) road.isWall = false;
  }
  room.turnState.soldiersActedThisTurn.push(soldierId);
  // A shot is final: neither it nor anything before it can be undone.
  room.turnState.undoLog = [];
  room.cannonShot = {
    kind: 'wall',
    cannonId: soldierId,
    shooterName: player.name,
    edgeId,
    wallOwnerName: road?.ownerId ?? '',
    roll: null,
    explosive,
    threshold,
    breached: explosive,
  };
}

/**
 * The shooter's breach-roll check: the pending wall shot is theirs, still
 * unrolled, and not an Explosive shot (which never rolls).
 */
export function canRollWallShot(room: GameRoom, player: Player): BuildCheck {
  const shot = room.cannonShot;
  if (!shot || shot.kind !== 'wall') return fail('No wall shot is in progress');
  if (shot.explosive || shot.roll !== null) return fail('That shot is already resolved');
  if (shot.shooterName !== player.name) return fail('Only the shooter rolls the breach die');
  return pass;
}

/**
 * Roll the breach die on a pending Single shot: a roll meeting `threshold`
 * reverts the wall to a normal road; a lower roll does nothing (the cannon's
 * action was already spent on fire). The rolled record lingers for the
 * cannon-shot reveal timer.
 */
export function applyRollWallShot(room: GameRoom, _player: Player, roll: number): void {
  const shot = room.cannonShot;
  if (!shot || shot.kind !== 'wall') return;
  const edge = room.board!.edges[shot.edgeId];
  const road = edge?.roadId ? room.board!.roads[edge.roadId] : undefined;
  shot.roll = roll;
  shot.breached = !!road && roll >= shot.threshold;
  if (shot.breached) road!.isWall = false;
}
