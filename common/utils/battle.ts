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
    phase: 'defenderRolling', // Defender rolls first to defend
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
  const attackerSoldiers: SoldierBattleState[] = (updatedStates[battleState.attacker]?.soldiers as
    | SoldierBattleState[]
    | undefined ?? [])
    .filter((s) => !s.dead && s.rollNum !== null)
    .sort((a, b) => (b.rollNum || 0) - (a.rollNum || 0));

  const defenderSoldiers: SoldierBattleState[] = (updatedStates[battleState.defender]?.soldiers as
    | SoldierBattleState[]
    | undefined ?? [])
    .filter((s) => !s.dead && s.rollNum !== null)
    .sort((a, b) => (b.rollNum || 0) - (a.rollNum || 0));

  // Pair up and resolve combat
  const maxPairs = Math.min(attackerSoldiers.length, defenderSoldiers.length);

  for (let i = 0; i < maxPairs; i++) {
    const attacker = attackerSoldiers[i];
    const defender = defenderSoldiers[i];

    const attRoll = attacker.rollNum || 0;
    const defRoll = defender.rollNum || 0;

    // Attacker wins (higher roll)
    if (attRoll > defRoll) {
      const diff = attRoll - defRoll;
      if (diff >= 2) {
        // Defender dies
        defender.dead = true;
        deadSoldierIds.push(defender.soldier.id);
      } else {
        // Defender injured (Rule 29)
        defender.injured = true;
        injuredSoldierIds.push(defender.soldier.id);
      }
    }
    // Defender wins (higher roll)
    else if (defRoll > attRoll) {
      const diff = defRoll - attRoll;
      if (diff >= 2) {
        // Attacker dies
        attacker.dead = true;
        deadSoldierIds.push(attacker.soldier.id);
      } else {
        // Attacker injured (Rule 29)
        attacker.injured = true;
        injuredSoldierIds.push(attacker.soldier.id);
      }
    }
    // Tie: no effect (could add reroll logic later per Rule 11)
  }

  // Check if battle is complete (one side eliminated or only injured left)
  const livingAttackers = attackerSoldiers.filter((s) => !s.dead).length;
  const livingDefenders = defenderSoldiers.filter((s) => !s.dead).length;

  const battleComplete = livingAttackers === 0 || livingDefenders === 0;

  return {
    updatedBattleState: { ...battleState, states: updatedStates },
    deadSoldierIds,
    injuredSoldierIds,
    battleComplete,
  };
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
