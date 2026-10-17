/**
 * Battle commit rules — the apply half of a battle.
 *
 * `common/utils/battle` decides a round (state, rolls, resolution, outcome);
 * this module commits the decision to the room: casualties onto the board,
 * the Conqueror win count, the robber-fight outcome, and the repositioning
 * hand-off. These used to live in the backend handler where the robber
 * fight couldn't be unit-tested (its entry took `io` just to emit).
 * Effects are returned, not performed.
 */
import type { Board, HexId } from '../types/Board';
import type { BattleState, BuildCheck } from '../types/Logic';
import type { GameRoom } from '../types/Room';
import { RESOURCES } from '../Constant';
import { canMoveRobberAdjacent, placeRobber } from '../utils/robber';
import { nextRepositionTurn } from '../utils/battle/reposition';
import { resolveBattleOutcome } from '../utils/battle/outcome';
import type { GameEffect } from './effects';

const pass: BuildCheck = { allowed: true, reason: null };
const fail = (reason: string): BuildCheck => ({ allowed: false, reason });

/**
 * Apply a resolved round's casualties to the board. Injured survivors are
 * marked on the board and recorded in `injuredSettled` (their resting
 * vertex) so repositioning can move them along a road.
 * Returns the resting-vertex map for the battle state.
 */
export function applyRoundCasualties(
  board: Board,
  battleState: BattleState
): Record<string, string> {
  const injuredSettled: Record<string, string> = {};
  for (const side of Object.values(battleState.states)) {
    for (const s of side.soldiers) {
      if (s.dead) {
        delete board.soldiers[s.soldier.id];
      } else if (s.injured) {
        const soldier = board.soldiers[s.soldier.id];
        if (soldier) {
          soldier.injured = true;
          injuredSettled[s.soldier.id] = s.soldier.vertexId;
        }
      }
    }
  }
  return injuredSettled;
}

/**
 * Whether a resolved round ends the battle: either side has no living,
 * uninjured troops left.
 */
export function battleSideDown(battle: BattleState): boolean {
  const attackersAlive = (battle.states[battle.attacker]?.soldiers ?? []).some(
    (s) => !s.dead && !s.injured
  );
  const defendersAlive = (battle.states[battle.defender]?.soldiers ?? []).some(
    (s) => !s.dead && !s.injured
  );
  return !attackersAlive || !defendersAlive;
}

/**
 * Count a won player-vs-player battle toward the Conqueror bonus. The winner
 * rule itself lives in `resolveBattleOutcome` — the same function the UI's
 * outcome panel reads, so the credited win can never disagree with what the
 * outcome panel shows. `earlyEnd` marks an undecided battle as a forfeit
 * (the attacker fled) and the defender takes the win.
 */
export function recordBattleWin(room: GameRoom, battle: BattleState, earlyEnd = false): void {
  const outcome = resolveBattleOutcome(battle, earlyEnd);
  if (outcome.forfeitedBy) battle.forfeitedBy = outcome.forfeitedBy;
  const winner = outcome.winner;
  if (!winner || !room.players.some((p) => p.name === winner)) return;
  room.battlesWon[winner] = (room.battlesWon[winner] ?? 0) + 1;
}

/** Gate shared by continueBattle and endBattle: attacker + resolved round. */
export function canDriveBattle(room: GameRoom, playerName: string): BuildCheck {
  const battle = room.battleState;
  if (!room.board || !battle) return fail('No battle in progress');
  if (battle.attacker !== playerName) {
    return fail('Only the attacker can continue this battle');
  }
  if (battle.phase !== 'betweenRounds') {
    return fail('The round has not been resolved yet');
  }
  return pass;
}

/**
 * Commit a resolved round and continue: apply casualties, then either end
 * the battle into repositioning (a side is down) or reset all rolls for the
 * next round. Assumes `canDriveBattle` passed.
 */
export function applyContinueBattle(room: GameRoom): void {
  const board = room.board!;
  const battle = room.battleState!;
  const injuredSettled = applyRoundCasualties(board, battle);

  if (battleSideDown(battle)) {
    recordBattleWin(room, battle);
    room.battleState = {
      ...battle,
      phase: 'repositioning',
      injuredSettled,
      repositionTurn: nextRepositionTurn(board, battle, null),
    };
  } else {
    // Both sides still standing: reset ALL rolls so no troop carries a
    // stale die into the next round. Injured troops are out of the fight
    // (Rule 28) and won't re-roll, but clearing their rollNum prevents
    // them from appearing in the matchup table.
    for (const side of Object.values(battle.states)) {
      for (const s of side.soldiers) {
        s.rollNum = null;
      }
    }
    room.battleState = {
      ...battle,
      phase: 'rolling',
      round: battle.round + 1,
      injuredSettled,
    };
  }
}

/**
 * The attacker's voluntary end: commit casualties and move to repositioning.
 * Ending an undecided battle is a forfeit — the defender is credited.
 * Assumes `canDriveBattle` passed.
 */
export function applyEndBattle(room: GameRoom): void {
  const board = room.board!;
  const battle = room.battleState!;
  const injuredSettled = applyRoundCasualties(board, battle);
  recordBattleWin(room, battle, true);
  room.battleState = {
    ...battle,
    phase: 'repositioning',
    injuredSettled,
    repositionTurn: nextRepositionTurn(board, battle, null),
  };
}

/**
 * Apply the outcome of a resolved robber fight: the attacker wins only on a
 * strictly higher roll (the robber wins ties). Win → take the robber bag and
 * owe an adjacent robber move; lose → the robber kills the soldier. Records
 * the player's once-per-phase fight and returns the broadcast effect.
 */
export function applyRobberFightOutcome(room: GameRoom, battle: BattleState): GameEffect[] {
  const board = room.board!;
  const attacker = room.players.find((p) => p.name === battle.attacker)!;
  const attackerSoldier = battle.states[battle.attacker].soldiers[0];
  const soldierId = attackerSoldier.soldier.id;
  const soldierRoll = attackerSoldier.rollNum ?? 0;
  const robberRoll = battle.states['Robber'].soldiers[0].rollNum ?? 0;
  const won = soldierRoll > robberRoll;

  if (won) {
    // The winner takes the entire robber bag.
    for (const r of RESOURCES) {
      attacker.resources[r] += room.robberBag[r];
    }
    room.robberBag = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };
    // The winner may move the robber to any adjacent hex (Rules.md).
    const robberHex = Object.values(board.hexes).find((h) => h.robber)?.id;
    if (robberHex) {
      room.robberDefeatedBy = { playerName: battle.attacker, fromHexId: robberHex };
    }
  } else {
    // The robber kills the soldier.
    delete board.soldiers[soldierId];
  }

  // The fight consumes the player's once-per-phase robber fight.
  room.turnState.robberFoughtThisPhase.push(battle.attacker);

  return [
    {
      kind: 'robberFightResult',
      result: { playerName: battle.attacker, soldierId, soldierRoll, robberRoll, won },
    },
  ];
}

/** Gate for moveRobberAfterWin: a fight was won by this player. */
export function canMoveRobberAfterWin(
  room: GameRoom,
  playerName: string,
  hexId: HexId
): BuildCheck {
  const board = room.board;
  if (!board) return fail('Game board is not available');
  const choice = room.robberDefeatedBy;
  if (!choice) return fail('No robber fight to move from');
  if (choice.playerName !== playerName) {
    return fail('Only the robber fight winner can move the robber');
  }
  return canMoveRobberAdjacent(board, choice.fromHexId, hexId);
}

/** Apply the post-win robber move. Assumes `canMoveRobberAfterWin` passed. */
export function applyMoveRobberAfterWin(room: GameRoom, hexId: HexId): void {
  placeRobber(room.board!, hexId);
  room.robberDefeatedBy = null;
}
