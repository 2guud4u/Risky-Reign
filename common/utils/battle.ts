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
 * - Target vertex must have enemy presence
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

  // Check target vertex has enemy presence (settlement or soldiers)
  const targetVertex = board.vertices[targetVertexId];
  if (!targetVertex) {
    return { allowed: false, reason: 'Target vertex not found' };
  }

  const hasEnemySettlement =
    targetVertex.settlementId !== null &&
    board.settlements[targetVertex.settlementId]?.ownerId !== attackerName;

  const hasEnemySoldiers = Object.values(board.soldiers).some(
    (s) => s.vertexId === targetVertexId && s.owner !== attackerName
  );

  if (!hasEnemySettlement && !hasEnemySoldiers) {
    return { allowed: false, reason: 'No enemy presence at target location' };
  }

  // Check soldiers are at or adjacent to target vertex
  for (const soldierId of soldierIds) {
    const soldier = board.soldiers[soldierId];
    if (!isAdjacentOrSame(soldier.vertexId, targetVertexId, board)) {
      return { allowed: false, reason: `Soldier at ${soldier.vertexId} is not adjacent to target` };
    }
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

  // Find defender (owner of settlement or majority soldiers)
  let defenderName = '';
  if (targetVertexId && board.vertices[targetVertexId]?.settlementId) {
    defenderName = board.settlements[board.vertices[targetVertexId]!.settlementId!]?.ownerId || '';
  } else {
    // Find player with most soldiers at target
    const soldiersAtTarget = Object.values(board.soldiers).filter(
      (s) => s.vertexId === targetVertexId && s.owner !== attackerName
    );
    if (soldiersAtTarget.length > 0) {
      defenderName = soldiersAtTarget[0].owner;
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

  // Defender's soldiers (all at the target vertex)
  const defenderSoldiers = Object.values(board.soldiers).filter(
    (s) => s.vertexId === targetVertexId && s.owner === defenderName
  );

  if (defenderSoldiers.length > 0) {
    states[defenderName] = {
      soldiers: defenderSoldiers.map((s) => ({
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

/**
 * Resolve a single battle round.
 * Rules:
 * - Each soldier rolls 1d6
 * - Compare rolls pairwise (highest vs highest)
 * - If opponent's roll is <2 lower than yours → injured (Rule 29)
 * - If opponent's roll is >=2 lower → dies
 */
export function resolveBattleRound(battleState: BattleState): {
  updatedBattleState: BattleState;
  deadSoldierIds: string[];
  injuredSoldierIds: string[];
  battleComplete: boolean;
} {
  const updatedStates = JSON.parse(JSON.stringify(battleState.states)); // Deep copy
  const deadSoldierIds: string[] = [];
  const injuredSoldierIds: string[] = [];

  // Roll for all soldiers that haven't rolled yet
  for (const playerName of Object.keys(updatedStates)) {
    for (const soldierState of updatedStates[playerName].soldiers) {
      if (!soldierState.dead && soldierState.rollNum === null) {
        soldierState.rollNum = rollDie();
      }
    }
  }

  // Get living soldiers from both sides, sorted by roll (descending)
  resolvePairs(updatedStates, battleState.attacker, battleState.defender, deadSoldierIds, injuredSoldierIds);

  // Check if battle is complete (one side eliminated or only injured left)
  const livingAttackers = sideOf(updatedStates, battleState.attacker).filter((s) => !s.dead).length;
  const livingDefenders = sideOf(updatedStates, battleState.defender).filter((s) => !s.dead).length;

  const battleComplete = livingAttackers === 0 || livingDefenders === 0;

  return {
    updatedBattleState: { ...battleState, states: updatedStates },
    deadSoldierIds,
    injuredSoldierIds,
    battleComplete,
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
  const attackerSoldiers = sideOf(states, attacker)
    .filter((s) => !s.dead && s.rollNum !== null)
    .sort((a, b) => (b.rollNum || 0) - (a.rollNum || 0));
  const defenderSoldiers = sideOf(states, defender)
    .filter((s) => !s.dead && s.rollNum !== null)
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

/**
 * Record the die a player just rolled for one of their committed soldiers.
 * The server is the source of truth: it ignores any soldier the player does
 * not own, that is dead, or that already has a roll this round.
 */
export function rollBattleDie(
  battleState: BattleState,
  playerName: string,
  soldierId: string
): { updated: BattleState; value: number } {
  const side = battleState.states[playerName];
  const soldier = side?.soldiers.find((s) => s.soldier.id === soldierId);
  if (!side || !soldier || soldier.dead || soldier.rollNum !== null) {
    return { updated: battleState, value: soldier?.rollNum ?? 0 };
  }
  const value = rollDie();
  soldier.rollNum = value;
  return { updated: battleState, value };
}

/** True when every living committed soldier has rolled for the current round. */
export function allSoldiersRolled(battleState: BattleState): boolean {
  return Object.keys(battleState.states).every(
    (name) =>
      battleState.states[name].soldiers.every((s) => s.dead || s.rollNum !== null)
  );
}

/**
 * Whether a player may roll the given die: the battle must be in the rolling
 * phase, the soldier must be committed by that player, alive, and not yet
 * rolled. (Each soldier rolls once per round.)
 */
export function canRollBattleDie(
  battleState: BattleState,
  playerName: string,
  soldierId: string
): boolean {
  if (battleState.phase !== 'rolling') return false;
  const soldier = battleState.states[playerName]?.soldiers.find((s) => s.soldier.id === soldierId);
  return Boolean(soldier && !soldier.dead && soldier.rollNum === null);
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

  const livingAttackers = sideOf(updatedStates, battleState.attacker).filter((s) => !s.dead).length;
  const livingDefenders = sideOf(updatedStates, battleState.defender).filter((s) => !s.dead).length;
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
 * Check if two vertices are adjacent or the same.
 */
function isAdjacentOrSame(vertexAId: string, vertexBId: string, board: Board): boolean {
  if (vertexAId === vertexBId) return true;

  const vertexA = board.vertices[vertexAId];
  if (!vertexA) return false;

  // Check if vertexB is connected via any edge from vertexA
  for (const edgeId of vertexA.roadIds) {
    const edge = board.edges[edgeId];
    if (edge && (edge.vertexAId === vertexBId || edge.vertexBId === vertexBId)) {
      return true;
    }
  }

  return false;
}
