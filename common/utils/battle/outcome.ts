import { BattleOutcome, BattleState } from '../../index';
import { sideOf } from './state';

/**
 * The winner-of-the-battle rule — the single source of truth shared by the
 * server (credits `battlesWon` toward the Conqueror bonus) and the UI (the
 * outcome panel). Keep every "who won" decision here; consumers must not
 * re-derive the winner locally.
 */

/**
 * Resolve a battle's verdict: the winner plus the per-side casualty tally.
 *
 * Winner rules (Rules.md):
 * - Forfeit: if `forfeitedBy` is already recorded, the defender won.
 * - Robber fight: the attacker wins only on a strictly higher roll (the
 *   robber wins ties).
 * - Injured fight: injured defenders never count as "standing" — they win by
 *   escaping (any survivor), the attacker wins only by killing every one.
 * - Normal fight: the side still holding living, uninjured troops wins; a
 *   mutual wipeout has no winner.
 * - `earlyEnd` (attacker chose to stop while both sides still stand) is a
 *   forfeit: the defender wins and `forfeitedBy` is the attacker. A decided
 *   battle is never flipped — a wiped-out side already lost, and a "See
 *   result" click must not turn a real result into a forfeit.
 */
export function resolveBattleOutcome(battle: BattleState, earlyEnd = false): BattleOutcome {
  const atk = sideOf(battle.states, battle.attacker);
  const def = sideOf(battle.states, battle.defender);
  const atkAlive = atk.filter((s) => !s.dead && !s.injured).length;
  const defAlive = def.filter((s) => !s.dead && !s.injured).length;
  const atkDead = atk.filter((s) => s.dead).length;
  const defDead = def.filter((s) => s.dead).length;
  const atkInj = atk.filter((s) => s.injured && !s.dead).length;
  const defInj = def.filter((s) => s.injured && !s.dead).length;

  let winner: string | null = null;
  let forfeitedBy: string | undefined;
  if (battle.forfeitedBy) {
    winner = battle.defender;
    forfeitedBy = battle.forfeitedBy;
  } else if (battle.robberFight) {
    // Nobody is marked dead in a robber fight: the attacker wins only on a
    // strictly higher roll.
    const soldierRoll = atk[0]?.rollNum ?? 0;
    const robberRoll = def[0]?.rollNum ?? 0;
    winner = soldierRoll > robberRoll ? battle.attacker : battle.defender;
  } else if (battle.injuredFight) {
    winner = def.some((s) => !s.dead) ? battle.defender : battle.attacker;
  } else if (earlyEnd && atkAlive > 0 && defAlive > 0) {
    winner = battle.defender;
    forfeitedBy = battle.attacker;
  } else if (atkAlive > 0 && defAlive === 0) {
    winner = battle.attacker;
  } else if (defAlive > 0 && atkAlive === 0) {
    winner = battle.defender;
  }

  return { atkAlive, defAlive, atkDead, defDead, atkInj, defInj, winner, forfeitedBy };
}
