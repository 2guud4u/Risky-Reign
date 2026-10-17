/**
 * Pending actions: the deferred resolutions a room can hold between a player's
 * event and its completion (the pending half of the turn machine).
 *
 * One deep module owns the protocol: the wire fields on `GameRoom`
 * (`robberMove`, `robberDefeatedBy`, `steal`, `devCardChoice`, `discards`,
 * `battleState`) stay as-is for broadcast compatibility, but every "who must
 * do what next" question is answered here — `pendingActions` lists what a room
 * (or player) is waiting on, and `pendingBlock` is the single blocking table
 * that used to be hand-wired into each handler.
 */
import type { GameRoom } from '../types/Room';

/** The deferred-resolution kinds a room can hold at once. */
export type PendingActionKind =
  /** A 7 was rolled or a Knight was played: the named player must place the robber. */
  | 'robberMove'
  /** The robber lost a fight: the winner must move it to an adjacent hex. */
  | 'robberMoveAfterWin'
  /** A 7 landed: the thief must pick a victim (and later a card). */
  | 'steal'
  /** Year of Plenty / Monopoly / Knight effect awaiting the player's choice. */
  | 'devCardChoice'
  /** A 7 landed: each named player must hand in half their resources. */
  | 'discards'
  /** A battle is in progress: the Action phase is suspended. */
  | 'battle';

/** One outstanding resolution, normalized across the wire fields. */
export interface PendingAction {
  kind: PendingActionKind;
  /** Name of the player who must act (discards yields one entry per player). */
  player: string;
}

/** Every outstanding resolution in the room, across all players. */
export function pendingActions(room: GameRoom): PendingAction[] {
  const out: PendingAction[] = [];
  if (room.battleState) {
    // Both sides have work in a battle; the attacker drives it.
    out.push({ kind: 'battle', player: room.battleState.attacker });
  }
  if (room.robberDefeatedBy) {
    out.push({ kind: 'robberMoveAfterWin', player: room.robberDefeatedBy.playerName });
  }
  if (room.robberMove) out.push({ kind: 'robberMove', player: room.robberMove.player });
  if (room.steal) out.push({ kind: 'steal', player: room.steal.thief });
  if (room.devCardChoice) out.push({ kind: 'devCardChoice', player: room.devCardChoice.player });
  for (const player of Object.keys(room.discards)) {
    out.push({ kind: 'discards', player });
  }
  return out;
}

/** The resolutions this one player owes (what the UI may prompt for). */
export function pendingFor(room: GameRoom, playerName: string): PendingAction[] {
  return pendingActions(room).filter((a) => a.player === playerName);
}

/**
 * Is this player mid-knight-choice waiting only on the spawn placement?
 * The knight's robber branch clears devCardChoice into robberMove; 'spawn'
 * keeps the choice and sets `spawn: true` until knightSpawnSoldier resolves.
 */
export function knightSpawnPending(room: GameRoom, playerName: string): boolean {
  const c = room.devCardChoice;
  return !!c && c.card === 'knight' && !!c.spawn && c.player === playerName;
}

/**
 * The one table: does a pending action block this event for this player?
 * Returns the user-facing error message to emit, or null when the action may
 * proceed. Every action handler asks this instead of hand-checking fields.
 *
 * Semantics preserved from the original scattered guards:
 * - A 'seven' robber move cannot be placed while any discards are owed.
 * - The Dice phase (rollDice) is held while the 7's robber move or the
 *   steal that followed it is unresolved — the dice player is the only
 *   caller, so the check is room-scoped.
 * - Playing a development card is blocked only by that player's own
 *   pending robber move or card choice.
 * - endTurn is blocked by an active battle or a robberDefeatedBy owed by
 *   the acting player (checked by the endTurn action itself for phase
 *   scoping — it returns its own message).
 */
export function pendingBlock(
  room: GameRoom,
  playerName: string,
  action:
    | 'rollDice'
    | 'moveRobber'
    | 'playDevelopmentCard'
    | 'endTurn'
): string | null {
  switch (action) {
    case 'rollDice':
      if (room.robberMove?.reason === 'seven' || room.steal) {
        return 'Resolve the 7 before rolling again';
      }
      return null;
    case 'moveRobber':
      if (room.robberMove?.reason === 'seven' && Object.keys(room.discards).length > 0) {
        return 'Resolve the 7 discards before moving the robber';
      }
      return null;
    case 'playDevelopmentCard':
      if (room.robberMove && room.robberMove.player === playerName) {
        return 'Move the robber before playing another card';
      }
      if (room.devCardChoice && room.devCardChoice.player === playerName) {
        return 'Resolve your card choice before playing another card';
      }
      return null;
    case 'endTurn':
      if (room.battleState) {
        return 'A battle is in progress';
      }
      if (
        room.turnState.phase === 'Action' &&
        room.robberDefeatedBy &&
        room.robberDefeatedBy.playerName === playerName
      ) {
        return 'Move the robber to an adjacent hex before ending the Action phase';
      }
      return null;
  }
}
