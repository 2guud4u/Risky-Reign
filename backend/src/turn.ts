import { GameRoom, nextTurnPosition } from 'common';

/**
 * Advance the room's turn/phase state machine based on the current phase.
 * The order itself comes from `nextTurnPosition` (shared with the UI's turn
 * timeline); this applies it plus each transition's per-phase resets.
 * Mutates `room.turnState` (and `room.roll` when a new Dice phase begins).
 */
export function advanceTurn(room: GameRoom): void {
  // A finished game never advances: the turn machine is frozen at the
  // moment the win condition is met.
  if (room.gameStatus === 'finished') return;
  const turnState = room.turnState;
  const from = turnState.phase;
  const next = nextTurnPosition(turnState);
  room.turnState = { ...turnState, ...next, undoLog: [] };

  if (from === 'SetUp' && next.phase === 'SetUp') {
    room.turnState.placedSettlement = false;
    room.turnState.placedRoad = false;
  } else if (from === 'SetUp') {
    // Setup complete: a new round begins. Clear the per-round soldier
    // restrictions (Rule 24/25) so soldiers garrisoned during setup can move
    // in the first Action phase.
    room.turnState.placedSettlement = null;
    room.turnState.placedRoad = null;
    room.turnState.soldiersCreatedThisTurn = [];
    room.turnState.soldiersHealedThisTurn = [];
    room.roll = { die1: null, die2: null };
  } else if (from === 'Build' && next.phase === 'Action') {
    // A new Action phase begins: reset the per-soldier action count.
    room.turnState.soldiersActedThisTurn = [];
    room.turnState.robberFoughtThisPhase = [];
  } else if (from === 'Action') {
    // The robber-move option belongs to the Action phase it was won in.
    room.robberDefeatedBy = null;
    if (next.phase === 'Dice') {
      // A new round begins: clear the per-round soldier restrictions (Rule 24/25).
      room.turnState.soldiersCreatedThisTurn = [];
      room.turnState.soldiersHealedThisTurn = [];
      room.roll = { die1: null, die2: null };
      // Cards bought last turn are now playable.
      for (const p of room.players) p.devCardsBoughtThisTurn = 0;
    }
  }
}
