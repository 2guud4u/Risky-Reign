import { SoldierObj, TurnState } from 'common';

/**
 * Whether a soldier still has its one action to spend this phase. Injured
 * soldiers can still spend it on a move (they just can't attack — Rule 28),
 * so injury does not block the action.
 */
export function soldierCanAct(soldier: SoldierObj, turn: TurnState | undefined): boolean {
  if (!turn) return false;
  return (
    !turn.soldiersActedThisTurn.includes(soldier.id) &&
    !turn.soldiersCreatedThisTurn.includes(soldier.id)
  );
}
