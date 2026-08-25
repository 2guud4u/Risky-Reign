import { GameRoom, BattleState, SoldierBattleState, Board } from '../index';

/**
 * Combat resolution logic for soldier battles.
 * Pure functions that operate on game state and return new state or results.
 */

/** Roll a single 1-6 die. */
export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Check if a battle can be started at the given vertex.
 * Rules:
 * - Must be in Action phase
 * - Attacker must own selected soldiers
 * - Soldiers must not be injured (Rule 28)
 * - Soldiers cannot have been created this turn (Rule 24)
 * - Every attacking soldier must be on the target vertex
 * - Target vertex must have enemy soldiers (a settlement is not required)
 */
export function canStartBattle(
  room: GameRoom,
  attackerName: string,
  soldierIds: string[],
  targetVertexId: string
): { allowed: boolean; reason?: string } {
  const turnState = room.turnState;

  // Must be Action phase
  if (turnState.phase !== 'Action') {
    return { allowed: false, reason: 'Can only attack during Action phase' };
  }

  // Must be the current player's turn
  if (turnState.player !== attackerName) {
    return { allowed: false, reason: 'Not your turn to act' };
  }

  if (soldierIds.length === 0) {
    return { allowed: false, reason: 'Select at least one soldier to attack with' };
  }

  const board = room.board;
  if (!board) {
    return { allowed: false, reason: 'No board available' };
  }

  // Validate all soldiers belong to attacker and meet requirements
  for (const soldierId of soldierIds) {
    const soldier = board.soldiers[soldierId];
    if (!soldier) {
      return { allowed: false, reason: `Soldier ${soldierId} not found` };
    }

    if (soldier.owner !== attackerName) {
      return { allowed: false, reason: 'You do not own this soldier' };
    }

    // Rule 28: Injured state cannot attack
    if (soldier.injured) {
      return { allowed: false, reason: `Soldier at ${soldier.vertexId} is injured and cannot attack` };
    }

    // Rule 30: each soldier gets one action per Action phase
    if (turnState.soldiersActedThisTurn.includes(soldierId)) {
      return { allowed: false, reason: 'A selected soldier already used its action this phase' };
    }

    // Rule 24: Cannot create and move/attack on same turn
    if (turnState.soldiersCreatedThisTurn.includes(soldierId)) {
      return { allowed: false, reason: 'Soldier was just created and cannot attack this turn' };
    }
  }

  // Target vertex must exist
  const targetVertex = board.vertices[targetVertexId];
  if (!targetVertex) {
    return { allowed: false, reason: 'Target vertex not found' };
  }

  // Every attacking soldier must be on the target vertex
  for (const soldierId of soldierIds) {
    const soldier = board.soldiers[soldierId];
    if (soldier.vertexId !== targetVertexId) {
      return { allowed: false, reason: `Soldier at ${soldier.vertexId} must be on the target vertex (${targetVertexId}) to attack` };
    }
  }

  // Target vertex must have (uninjured) enemy soldiers (no settlement needed).
  // Injured troops are out of the fight (Rule 28), so they don't count.
  const hasEnemySoldiers = Object.values(board.soldiers).some(
    (s) => s.vertexId === targetVertexId && s.owner !== attackerName && !s.injured
  );

  if (!hasEnemySoldiers) {
    return { allowed: false, reason: 'No enemy soldiers at this vertex to attack' };
  }

  return { allowed: true };
}

/**
 * Initialize a battle state when an attack starts.
 */
export function createBattleState(
  room: GameRoom,
  attackerName: string,
  soldierIds: string[],
  targetVertexId: string
): BattleState {
  const board = room.board!;

  // The defender faces every enemy troop garrisoned at the target vertex
  // (Rules.md line 7: "Defender defend with whatever is on the defending
  // turf"), even when those troops belong to several different players.
  // Injured troops are counted as gone from the battle and are not committed
  // (Rule 28: injured state cannot attack).
  const enemySoldiers = Object.values(board.soldiers).filter(
    (s) => s.vertexId === targetVertexId && s.owner !== attackerName && !s.injured
  );

  // Choose the defending player's label: the settlement owner when they have
  // troops here, otherwise the player with the most troops at the vertex.
  let defenderName = '';
  const counts = new Map<string, number>();
  for (const s of enemySoldiers) counts.set(s.owner, (counts.get(s.owner) ?? 0) + 1);
  if (counts.size > 0) {
    let best: [string, number] = ['', 0];
    for (const [name, count] of counts) {
      if (count > best[1] || (count === best[1] && name < best[0])) best = [name, count];
    }
    defenderName = best[0];
    const settlementOwner =
      board.vertices[targetVertexId]?.settlementId
        ? board.settlements[board.vertices[targetVertexId].settlementId]?.ownerId
        : undefined;
    if (settlementOwner && (counts.get(settlementOwner) ?? 0) > 0) {
      defenderName = settlementOwner;
    }
  }

  // Create battle state with committed soldiers
  const states: Record<string, { soldiers: SoldierBattleState[] }> = {};

  // Attacker's soldiers
  states[attackerName] = {
    soldiers: soldierIds.map((id) => ({
      soldier: board.soldiers[id],
      rollNum: null,
      dead: false,
      injured: false,
    })),
  };

  // All defending troops at the target, keyed under the defender's label.
  if (enemySoldiers.length > 0) {
    states[defenderName] = {
      soldiers: enemySoldiers.map((s) => ({
        soldier: s,
        rollNum: null,
        dead: false,
        injured: false,
      })),
    };
  }

  return {
    attacker: attackerName,
    defender: defenderName,
    vertexId: targetVertexId,
    states,
    phase: 'rolling',
    round: 1,
  };
}


/** Living soldiers of one side in the given states, or an empty list. */
function sideOf(
  states: BattleState['states'],
  playerName: string
): SoldierBattleState[] {
  return states[playerName]?.soldiers ?? [];
}

/**
 * Maximum soldiers that may fight on a side in a single round. Only the first
 * `MAX_PER_ROUND` committed troops (in commitment order) that are still
 * standing engage each round; the rest wait in reserve and step up as the
 * front line falls.
 */
export const MAX_PER_ROUND = 3;

/**
 * The troops that fight on a given side this round: the first
 * `MAX_PER_ROUND` committed soldiers (in order) that are still living and
 * uninjured. Dead/injured troops have dropped out of the line, so the next
 * committed troops roll into the front automatically.
 */
export function activeSoldiersOf(
  states: BattleState['states'],
  playerName: string
): SoldierBattleState[] {
  return sideOf(states, playerName)
    .filter((s) => !s.dead && !s.injured)
    .slice(0, MAX_PER_ROUND);
}

/**
 * Compare the rolled dice highest-vs-lowest and mark casualties in place:
 * the highest roll fights the highest roll, the second highest the second,
 * and so on (ties have no effect). A win by >=2 kills the loser, by 1 injures.
 */
function resolvePairs(
  states: BattleState['states'],
  attacker: string,
  defender: string,
  deadSoldierIds: string[],
  injuredSoldierIds: string[]
): void {
  // Only the active front line (first MAX_PER_ROUND standing troops) that have
  // rolled take part in the matchup. Injured troops are out of the fight
  // (Rule 28); reserve troops beyond the front line haven't stepped up yet.
  const attackerSoldiers = activeSoldiersOf(states, attacker)
    .filter((s) => s.rollNum !== null)
    .sort((a, b) => (b.rollNum || 0) - (a.rollNum || 0));
  const defenderSoldiers = activeSoldiersOf(states, defender)
    .filter((s) => s.rollNum !== null)
    .sort((a, b) => (b.rollNum || 0) - (a.rollNum || 0));

  const maxPairs = Math.min(attackerSoldiers.length, defenderSoldiers.length);
  for (let i = 0; i < maxPairs; i++) {
    const atk = attackerSoldiers[i];
    const def = defenderSoldiers[i];
    const attRoll = atk.rollNum || 0;
    const defRoll = def.rollNum || 0;
    if (attRoll > defRoll) {
      if (attRoll - defRoll >= 2) {
        def.dead = true;
        deadSoldierIds.push(def.soldier.id);
      } else {
        def.injured = true;
        injuredSoldierIds.push(def.soldier.id);
      }
    } else if (defRoll > attRoll) {
      if (defRoll - attRoll >= 2) {
        atk.dead = true;
        deadSoldierIds.push(atk.soldier.id);
      } else {
        atk.injured = true;
        injuredSoldierIds.push(atk.soldier.id);
      }
    }
  }
}

/** Find a committed soldier by id across every side of the battle. */
function findCommittedSoldier(
  battleState: BattleState,
  soldierId: string
): SoldierBattleState | null {
  for (const name of Object.keys(battleState.states)) {
    const found = battleState.states[name].soldiers.find((s) => s.soldier.id === soldierId);
    if (found) return found;
  }
  return null;
}

/**
 * Record the die a player just rolled for one of their committed soldiers.
 * The server is the source of truth: it ignores any soldier the player does
 * not own, that is dead, or that already has a roll this round. Ownership is
 * checked against the soldier's own owner, so a defending side keyed under a
 * shared label still lets each individual owner roll their troops.
 */
export function rollBattleDie(
  battleState: BattleState,
  playerName: string,
  soldierId: string
): { updated: BattleState; value: number } {
  const soldier = findCommittedSoldier(battleState, soldierId);
  if (
    !soldier ||
    soldier.soldier.owner !== playerName ||
    soldier.dead ||
    soldier.injured ||
    soldier.rollNum !== null
  ) {
    return { updated: battleState, value: soldier?.rollNum ?? 0 };
  }
  const value = rollDie();
  soldier.rollNum = value;
  return { updated: battleState, value };
}

/**
 * True when every soldier in the active front line has rolled for the
 * current round. Dead/injured troops are out of the fight, and reserve
 * troops beyond MAX_PER_ROUND don't roll until they step into the front —
 * otherwise a side with more than MAX_PER_ROUND troops would stall the
 * round forever.
 */
export function allSoldiersRolled(battleState: BattleState): boolean {
  return Object.keys(battleState.states).every(
    (name) =>
      activeSoldiersOf(battleState.states, name).every((s) => s.rollNum !== null)
  );
}

/**
 * Whether a player may roll the given die: the battle must be in the rolling
 * phase, the soldier must be committed, owned by that player, in the active
 * front line (first MAX_PER_ROUND standing troops), and not yet rolled.
 */
export function canRollBattleDie(
  battleState: BattleState,
  playerName: string,
  soldierId: string
): boolean {
  if (battleState.phase !== 'rolling') return false;
  const soldier = findCommittedSoldier(battleState, soldierId);
  if (
    !soldier ||
    soldier.soldier.owner !== playerName ||
    soldier.dead ||
    soldier.injured ||
    soldier.rollNum !== null
  ) {
    return false;
  }
  const sideName = Object.keys(battleState.states).find(
    (name) => battleState.states[name].soldiers.includes(soldier)
  );
  if (!sideName) return false;
  return activeSoldiersOf(battleState.states, sideName).includes(soldier);
}

/**
 * Resolve the current round once every committed soldier has rolled.
 * Returns the post-round battle state: 'betweenRounds' when both sides still
 * have survivors (the attacker decides whether to continue), 'rolling' when
 * the round is ready for fresh rolls, and `battleComplete` true when a side
 * is eliminated (the backend then clears the battle state).
 */
export function resolveBattleRoundIfComplete(
  battleState: BattleState
): {
  updatedBattleState: BattleState;
  deadSoldierIds: string[];
  injuredSoldierIds: string[];
  battleComplete: boolean;
} {
  if (!allSoldiersRolled(battleState)) {
    return {
      updatedBattleState: battleState,
      deadSoldierIds: [],
      injuredSoldierIds: [],
      battleComplete: false,
    };
  }

  const updatedStates = JSON.parse(JSON.stringify(battleState.states)); // Deep copy
  const deadSoldierIds: string[] = [];
  const injuredSoldierIds: string[] = [];
  resolvePairs(updatedStates, battleState.attacker, battleState.defender, deadSoldierIds, injuredSoldierIds);

  // A side is "gone" when it has no living, uninjured troops left.
  const livingAttackers = sideOf(updatedStates, battleState.attacker).filter(
    (s) => !s.dead && !s.injured
  ).length;
  const livingDefenders = sideOf(updatedStates, battleState.defender).filter(
    (s) => !s.dead && !s.injured
  ).length;
  const battleComplete = livingAttackers === 0 || livingDefenders === 0;

  // Keep the rolled values so the UI can show how the dice compared this
  // round. Rolls are reset by the backend when the attacker continues.
  const updated: BattleState = {
    ...battleState,
    states: updatedStates,
    phase: 'betweenRounds',
  };

  return { updatedBattleState: updated, deadSoldierIds, injuredSoldierIds, battleComplete };
}

/**
 * When a battle ends, only INJURED survivors leave the battle vertex: they
 * "escape" along a road to the nearest connected vertex (this is a forced
 * result of the battle, not a player action, so it bypasses the injured/
 * exhausted restriction). Healthy survivors do NOT move — they stay on the
 * vertex they fought on. If the vertex has no road to escape along, even the
 * injured stay put (they remain injured until healed). Mutates `board`.
 */
export function escapeInjuredSurvivors(board: Board, battle: BattleState): void {
  const vertex = board.vertices[battle.vertexId];
  if (!vertex) return;

  // Nearest vertex reachable via an existing road from the battle vertex.
  let dest: string | null = null;
  for (const edgeId of vertex.roadIds) {
    const edge = board.edges[edgeId];
    if (edge && edge.roadId !== null) {
      dest = edge.vertexAId === battle.vertexId ? edge.vertexBId : edge.vertexAId;
      break;
    }
  }

  // Only injured combatants escape; they stay injured (they will need a heal).
  const injuredIds = new Set<string>();
  for (const side of Object.values(battle.states)) {
    for (const s of side.soldiers) {
      if (!s.dead && s.injured) injuredIds.add(s.soldier.id);
    }
  }

  for (const id of injuredIds) {
    const soldier = board.soldiers[id];
    if (!soldier || soldier.vertexId !== battle.vertexId) continue;
    if (dest !== null) {
      soldier.vertexId = dest;
      soldier.stationed = false;
    }
    // No road out: the injured soldier simply stays where the battle ended.
  }
}

