import { BattleState, Board } from '../../index';
import { sideOf } from './state';
import { activeSoldiersOf, allSoldiersRolled } from './rolls';

/**
 * Combat resolution logic for soldier battles: comparing rolled dice into
 * casualties, advancing the round, and moving injured survivors off the
 * battlefield when a battle ends.
 */

/**
 * Resolve a robber fight: a single roll-off with no casualties — the attacker
 * wins only on a strictly higher roll (the robber wins ties). The outcome is
 * applied by the backend (win → take the bag; lose → the soldier is killed).
 */
function resolveRobberFight(
  _battle: BattleState,
  _deadSoldierIds: string[],
  _injuredSoldierIds: string[]
): void {
  // No casualties: the result is determined by comparing the rolls.
}

/**
 * Compare the rolled dice highest-vs-lowest and mark casualties in place:
 * the highest roll fights the highest roll, the second highest the second,
 * and so on (ties have no effect). A win by >=2 kills the loser, by 1 injures.
 */
function resolvePairs(
  battle: BattleState,
  deadSoldierIds: string[],
  injuredSoldierIds: string[]
): void {
  // Only the active front line (first MAX_PER_ROUND standing troops) that have
  // rolled take part in the matchup. Injured troops are out of the fight
  // (Rule 28); reserve troops beyond the front line haven't stepped up yet.
  const attackerSoldiers = activeSoldiersOf(battle, battle.attacker)
    .filter((s) => s.rollNum !== null)
    .sort((a, b) => (b.rollNum || 0) - (a.rollNum || 0));
  const defenderSoldiers = activeSoldiersOf(battle, battle.defender)
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

/**
 * Resolve an "injured fight" (Rules.md line 28): the attacker's rolls are
 * paired against the injured defenders' rolls (highest vs. highest). The
 * outcome only affects the injured defenders — if their roll is higher they
 * flee (stay injured, can move); otherwise they die. The attacker's troops
 * are unaffected.
 */
function resolveInjuredFight(
  battle: BattleState,
  deadSoldierIds: string[],
  injuredSoldierIds: string[]
): void {
  const attackerSoldiers = activeSoldiersOf(battle, battle.attacker)
    .filter((s) => s.rollNum !== null)
    .sort((a, b) => (b.rollNum || 0) - (a.rollNum || 0));
  const defenderSoldiers = activeSoldiersOf(battle, battle.defender)
    .filter((s) => s.rollNum !== null)
    .sort((a, b) => (b.rollNum || 0) - (a.rollNum || 0));
  const maxPairs = Math.min(attackerSoldiers.length, defenderSoldiers.length);
  for (let i = 0; i < maxPairs; i++) {
    const attRoll = attackerSoldiers[i].rollNum || 0;
    const defRoll = defenderSoldiers[i].rollNum || 0;
    if (defRoll > attRoll) {
      // Injured defender wins → they flee (stay injured, can move).
    } else {
      // Attacker wins (or tie) → the injured defender dies.
      defenderSoldiers[i].dead = true;
      deadSoldierIds.push(defenderSoldiers[i].soldier.id);
    }
  }
}

/**
 * Resolve the current round once every committed soldier has rolled.
 * Returns the post-round battle state: 'betweenRounds' when both sides still
 * have survivors (the attacker decides whether to continue), 'rolling' when
 * the last healthy defender fell but injured defenders remain — the battle
 * switches into an injured-fight roll-off (Rules.md lines 9, 30) — and
 * `battleComplete` true when a side is eliminated (the backend then clears
 * the battle state).
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
  const updatedBattle = { ...battleState, states: updatedStates };
  if (battleState.robberFight) {
    resolveRobberFight(updatedBattle, deadSoldierIds, injuredSoldierIds);
  } else if (battleState.injuredFight) {
    resolveInjuredFight(updatedBattle, deadSoldierIds, injuredSoldierIds);
  } else {
    resolvePairs(updatedBattle, deadSoldierIds, injuredSoldierIds);
  }

  // A side is "gone" when it has no living, uninjured troops left.
  const livingAttackers = sideOf(updatedStates, battleState.attacker).filter(
    (s) => !s.dead && !s.injured
  ).length;
  const livingDefenders = sideOf(updatedStates, battleState.defender).filter(
    (s) => !s.dead && !s.injured
  ).length;
  // A normal round that eliminated the last UNINJURED defender doesn't end
  // the battle when injured defenders remain (Rules.md lines 9, 30): those
  // injured troops roll off against the attacker's survivors — defender
  // higher → they flee (stay injured); otherwise they die. The attacker
  // keeps their rolled dice and sits the roll-off out ("attacker has left");
  // only the injured defenders roll, so their dice (including troops that
  // were injured this round) are reset. If the attacker is fully eliminated
  // there is nothing left to roll against, so the battle ends as normal.
  const injuredDefenders = sideOf(updatedStates, battleState.defender).filter(
    (s) => !s.dead && s.injured
  ).length;
  const defendersRollOff =
    !battleState.robberFight &&
    !battleState.injuredFight &&
    livingAttackers > 0 &&
    livingDefenders === 0 &&
    injuredDefenders > 0;
  if (defendersRollOff) {
    for (const s of sideOf(updatedStates, battleState.defender)) {
      s.rollNum = null;
    }
  }
  const battleComplete =
    battleState.robberFight || livingAttackers === 0 || (livingDefenders === 0 && !defendersRollOff);

  // Keep the rolled values so the UI can show how the dice compared this
  // round. Rolls are reset by the backend when the attacker continues.
  const updated: BattleState = {
    ...battleState,
    states: updatedStates,
    phase: defendersRollOff ? 'rolling' : 'betweenRounds',
    round: defendersRollOff ? battleState.round + 1 : battleState.round,
    injuredFight: battleState.injuredFight || defendersRollOff,
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
