import { PublicGameRoom, SoldierObj, TurnState } from 'common';

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

/**
 * The player's soldiers on `vertexId` that can be picked for a group action:
 * only on their own Action phase with no battle running, and only soldiers
 * that still have their action to spend. Shared by the map (tappable soldiers)
 * and the soldier action bubbles so both agree on who can be picked.
 */
export function actableSoldierIds(
  gameRoom: PublicGameRoom | null,
  playerName: string | undefined,
  vertexId: string | null
): string[] {
  if (!gameRoom?.board || !playerName || !vertexId) return [];
  const turn = gameRoom.turnState;
  if (turn.phase !== 'Action' || turn.player !== playerName || gameRoom.battleState) return [];
  return Object.values(gameRoom.board.soldiers ?? {})
    .filter((s) => s.vertexId === vertexId && s.owner === playerName && soldierCanAct(s, turn))
    .map((s) => s.id);
}
