import { BattleState, SoldierBattleState } from '../../index';
import { MAX_PER_ROUND } from '../../Constant';
import { sideOf } from './state';

/**
 * Die rolls for soldier battles: which troops fight each round, and the
 * checks/mutations that record a soldier's die.
 */

/** Roll a single 1-6 die. */
export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * The troops that fight on a given side this round: the first
 * `MAX_PER_ROUND` committed soldiers (in order) that are still living and
 * uninjured. Dead/injured troops have dropped out of the line, so the next
 * committed troops roll into the front automatically.
 */
export function activeSoldiersOf(
  battle: BattleState,
  playerName: string
): SoldierBattleState[] {
  // In an injured fight the defender's troops are already injured but still
  // fight (they roll), so include them. Otherwise injured troops are out.
  const includeInjured = battle.injuredFight && playerName === battle.defender;
  return sideOf(battle.states, playerName)
    .filter((s) => !s.dead && (includeInjured || !s.injured))
    .slice(0, MAX_PER_ROUND);
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

/** The name of the side (`states` key) a troop is committed to, if any. */
export const sideNameOf = (battle: BattleState, s: SoldierBattleState): string | undefined =>
  Object.keys(battle.states).find((name) => battle.states[name].soldiers.includes(s));

/** True when this is an injured fight and the soldier is on the defender's
 * side (the injured defenders that still roll). */
export function isInjuredFightDefender(
  battleState: BattleState,
  soldier: SoldierBattleState
): boolean {
  if (!battleState.injuredFight) return false;
  return sideNameOf(battleState, soldier) === battleState.defender;
}

/**
 * A soldier is "active" only if it is in the active front line (first
 * MAX_PER_ROUND standing troops on its side).
 */
export const isActiveSoldier = (battle: BattleState, s: SoldierBattleState): boolean => {
  const sideName = sideNameOf(battle, s);
  if (!sideName) return false;
  return activeSoldiersOf(battle, sideName).includes(s);
};

/**
 * A soldier can roll only if the battle is in the rolling phase, the troop
 * is in the active front line, owned by the player, alive, uninjured (unless
 * an injured-fight defender), and not yet rolled this round. The UI uses this
 * to show which dice are clickable; the server mirrors it in
 * `canRollBattleDie` so a stale UI can never trigger an illegal roll.
 */
export const canRollSoldier = (
  battle: BattleState,
  s: SoldierBattleState,
  playerName: string | undefined
): boolean =>
  battle.phase === 'rolling' &&
  playerName === s.soldier.owner &&
  !s.dead &&
  (!s.injured || isInjuredFightDefender(battle, s)) &&
  s.rollNum === null &&
  isActiveSoldier(battle, s);

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
    soldier.rollNum !== null
  ) {
    return { updated: battleState, value: soldier?.rollNum ?? 0 };
  }
  // Injured troops normally can't roll (Rule 28), but in an injured fight the
  // injured defenders DO roll.
  if (soldier.injured && !isInjuredFightDefender(battleState, soldier)) {
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
      activeSoldiersOf(battleState, name).every((s) => s.rollNum !== null)
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
    soldier.rollNum !== null
  ) {
    return false;
  }
  if (soldier.injured && !isInjuredFightDefender(battleState, soldier)) {
    return false;
  }
  const sideName = sideNameOf(battleState, soldier);
  if (!sideName) return false;
  return activeSoldiersOf(battleState, sideName).includes(soldier);
}
