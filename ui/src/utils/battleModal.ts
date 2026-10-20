import {
  BattlePhase,
  BattleState,
  Board,
  PixelCoord,
  SoldierBattleState,
  activeSoldiersOf,
  MAX_PER_ROUND,
} from 'common';
import { DiceMatch, RepositionTroop, TroopSlot } from '../types/battleModal';
import {
  CENTER_GAP,
  COL_W,
  ROW_H,
  SIDE_COL_MAX,
  SIDE_OFFSET,
} from '../constants';

/** Fallback colour for a troop icon whose owner has no mapped colour. */
export const FALLBACK_OWNER_COLOR = '#888';

/** The clash line spans at least this many rows so it stays visible. */
const MIN_CLASH_LINE_ROWS = 2;

/**
 * Whether a troop's casualties are still "pending" in the UI: during
 * 'betweenRounds', this round's results (dead/injured flags) are not shown
 * until the attacker clicks "continue battle". Only troops that actually
 * rolled this round (rollNum set) are affected; prior-round casualties and
 * reserves keep their committed state.
 */
export const isPending = (s: SoldierBattleState, phase: BattlePhase): boolean =>
  phase === 'betweenRounds' && s.rollNum !== null;

/** Effective dead flag for display, hiding pending casualties. */
export const effDead = (s: SoldierBattleState, phase: BattlePhase): boolean =>
  !isPending(s, phase) && s.dead;

/**
 * Effective injured flag for display, hiding pending casualties. A troop that
 * entered the fight already injured (an injured-fight defender) stays injured
 * the whole time — rolling must not make it "get up".
 */
export const effInjured = (s: SoldierBattleState, phase: BattlePhase): boolean =>
  s.injured && (!isPending(s, phase) || s.soldier.injured);

/**
 * Lay out one side's troops. Troops in the fight (rolled, not injured) line up
 * on the center clash line, ordered by roll (highest on top). Troops that have
 * not rolled yet, plus injured troops (out of the fight, Rule 28), sit in a
 * waiting line of vertical columns of up to SIDE_COL_MAX troops (a second
 * column sits just behind the first if there are more); unrolled troops go in
 * the front column so the ones that still need to roll are easy to see and
 * click. The battle window's minimap is enlarged to fit these lines.
 */
export function layoutSide(
  center: PixelCoord,
  side: SoldierBattleState[],
  isAttacker: boolean,
  phase: BattlePhase,
  isInjuredFightDefender = false
): TroopSlot[] {
  const sign = isAttacker ? -1 : 1;
  // The active front line: the first MAX_PER_ROUND standing troops (not dead,
  // not injured). In an injured fight the defender's troops are already
  // injured but still fight (they roll), so they count as standing.
  const standing = side.filter(
    (s) => !effDead(s, phase) && (isInjuredFightDefender || !effInjured(s, phase))
  );
  const frontLine = standing.slice(0, MAX_PER_ROUND);
  const frontLineIds = new Set(frontLine.map((s) => s.soldier.id));
  // The rest: beyond the front line, plus dead/injured troops.
  const rest = side.filter((s) => !frontLineIds.has(s.soldier.id));

  const slots: TroopSlot[] = [];
  const nCols = Math.max(1, Math.ceil(rest.length / SIDE_COL_MAX));
  rest.forEach((s, i) => {
    const col = Math.floor(i / SIDE_COL_MAX); // front col = 0 (nearest center)
    const row = i % SIDE_COL_MAX;
    // Front column sits closest to the center; deeper columns sit further out.
    const depthOffset = (col - (nCols - 1) / 2) * COL_W;
    slots.push({
      x: center.x + sign * (SIDE_OFFSET + sign * depthOffset),
      y: center.y + (row - (SIDE_COL_MAX - 1) / 2) * ROW_H,
      s,
    });
  });
  // The front line: pre-lined up in the center (clash line). Once the roll
  // outcomes come in, rolled troops order by roll (highest on top); unrolled
  // troops keep their position order below them.
  const orderedFrontLine = [...frontLine].sort((a, b) => {
    const aRolled = a.rollNum !== null;
    const bRolled = b.rollNum !== null;
    if (aRolled && bRolled) return (b.rollNum ?? 0) - (a.rollNum ?? 0);
    if (aRolled) return -1; // rolled troops first
    if (bRolled) return 1;
    return 0; // both unrolled: keep position order
  });
  orderedFrontLine.forEach((s, i) => {
    slots.push({
      x: center.x + sign * CENTER_GAP,
      y: center.y + (i - (MAX_PER_ROUND - 1) / 2) * ROW_H,
      s,
    });
  });
  return slots;
}

/**
 * Injured survivors of this battle, keyed by their current resting vertex
 * (from the repositioning map), so each can be dragged one road-step at a time.
 */
export function injuredTroopsOf(battle: BattleState, board: Board): RepositionTroop[] {
  const settled = battle.injuredSettled ?? {};
  const list: RepositionTroop[] = [];
  for (const [soldierId, vertexId] of Object.entries(settled)) {
    const s = board.soldiers[soldierId];
    if (s && s.injured) list.push({ soldierId, ownerName: s.owner, vertexId });
  }
  return list;
}

/** Troops still fighting this round: rolled and not dead/injured (pending-aware). */
const countInFight = (
  soldiers: SoldierBattleState[],
  phase: BattlePhase,
  injuredFightDefender: boolean
): number =>
  soldiers.filter(
    (s) => s.rollNum !== null && !effDead(s, phase) && (injuredFightDefender || !effInjured(s, phase))
  ).length;

/**
 * Pixel height of the center clash line. It spans only the troops in the
 * fight (at most MAX_PER_ROUND per side), not the waiting side line.
 */
export function clashLineSpread(battle: BattleState, phase: BattlePhase): number {
  const atkInFight = countInFight(battle.states[battle.attacker]?.soldiers ?? [], phase, false);
  const defInFight = countInFight(
    battle.states[battle.defender]?.soldiers ?? [],
    phase,
    !!battle.injuredFight
  );
  return Math.max(atkInFight, defInFight, MIN_CLASH_LINE_ROWS) * ROW_H;
}

/**
 * Who still needs to roll this round (by real owner). Only counts troops in
 * the active front line — reserves beyond MAX_PER_ROUND don't roll yet.
 */
export function computeWaitingLines(battle: BattleState, phase: BattlePhase): string[] {
  const waitingLines: string[] = [];
  if (phase === 'rolling') {
    const owners = new Set<string>();
    for (const side of Object.values(battle.states)) {
      for (const s of side.soldiers) owners.add(s.soldier.owner);
    }
    for (const name of owners) {
      let n = 0;
      for (const sideName of Object.keys(battle.states)) {
        for (const s of activeSoldiersOf(battle, sideName)) {
          if (s.soldier.owner === name && s.rollNum === null) n++;
        }
      }
      if (n > 0) waitingLines.push(`${name} (${n})`);
    }
  }
  return waitingLines;
}

/** Matched-up dice for the just-resolved round (highest vs highest, ...). */
export function computeDiceMatchup(
  battle: BattleState,
  attackerSoldiers: SoldierBattleState[],
  defenderSoldiers: SoldierBattleState[],
  phase: BattlePhase
): DiceMatch[] {
  const matchup: DiceMatch[] = [];
  if (phase === 'betweenRounds' || phase === 'finished' || phase === 'repositioning') {
    // Compare everyone holding a die: the server clears every die when the
    // next round starts, so only this round's rollers hold one. That keeps
    // the final round's dice on screen once the battle is over, even though
    // their casualties are committed by then.
    // Mirror resolvePairs: in a normal fight cannons pair as their side's
    // lowest roll, win their ties (cannon-vs-cannon goes to the defender),
    // and die on any lost roll.
    const isCannon = (s: SoldierBattleState) => s.soldier.type === 'cannon';
    const byRoll = (x: SoldierBattleState, y: SoldierBattleState) =>
      (!battle.injuredFight && (isCannon(x) ? 1 : isCannon(y) ? -1 : 0)) ||
      (y.rollNum ?? 0) - (x.rollNum ?? 0);
    const aList = attackerSoldiers.filter((s) => s.rollNum !== null).sort(byRoll);
    const dList = defenderSoldiers.filter((s) => s.rollNum !== null).sort(byRoll);
    for (let i = 0; i < Math.min(aList.length, dList.length); i++) {
      const ar = aList[i].rollNum ?? 0;
      const dr = dList[i].rollNum ?? 0;
      const atkCannon = isCannon(aList[i]);
      const defCannon = isCannon(dList[i]);
      let text: string;
      let cls: string;
      if (battle.injuredFight) {
        // Injured fight: the injured defender wins only on a strictly higher
        // roll (they flee, stay injured); a tie or loss kills them.
        if (dr > ar) {
          [text, cls] = ['Defender escapes', 'text-sky'];
        } else {
          [text, cls] = ['Defender killed', 'text-clay'];
        }
      } else if (ar > dr || (ar === dr && atkCannon && !defCannon)) {
        [text, cls] =
          ar - dr >= 2 || defCannon ? ['Defender killed', 'text-clay'] : ['Defender injured', 'text-gold'];
      } else {
        // Defender wins ties (a cannon dies on any lost roll).
        [text, cls] =
          dr - ar >= 2 || atkCannon ? ['Attacker killed', 'text-clay'] : ['Attacker injured', 'text-gold'];
      }
      matchup.push({ a: ar, d: dr, text, cls });
    }
  }
  return matchup;
}
