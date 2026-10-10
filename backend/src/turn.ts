import { GameRoom, nextTurnPosition } from 'common';
import { setPhaseDeadline } from './phaseTimer';

/**
 * Advance the room's turn/phase state machine based on the current phase.
 * The order itself comes from `nextTurnPosition` (shared with the UI's turn
 * timeline); this applies it plus each transition's per-phase resets.
 * Knocked-out players are skipped (they spectate, no more turns).
 * Mutates `room.turnState` (and `room.roll` when a new Dice phase begins).
 */
export function advanceTurn(room: GameRoom): void {
  // A finished game never advances: the turn machine is frozen at the
  // moment the win condition is met.
  if (room.gameStatus === 'finished') return;
  const turnState = room.turnState;
  const from = turnState.phase;
  const knockedOut = room.players.filter((p) => p.eliminated).map((p) => p.name);
  const next = nextTurnPosition(turnState, knockedOut, room.turnMode);
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
  } else if (next.phase === 'Dice' && from === 'Build') {
    // Second roll of the round (same dice player): fresh dice only — the
    // round's soldier restrictions carry on into its Action phase.
    room.roll = { die1: null, die2: null };
  } else if (next.phase === 'Action' && from !== 'Action') {
    // A new Action phase begins (from Build, or from the second roll):
    // reset the per-soldier action count.
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
  // Turn timer: a fresh countdown starts each time a Build or Action phase
  // begins (any other phase clears it). Battle suspension/resume is handled
  // by syncPhaseTimer off the broadcast.
  setPhaseDeadline(room);
}

/**
 * Pass the turn when the acting player has been knocked out mid-turn (their
 * last soldier died in their own battle). They can't act any more, so the
 * turn would otherwise wedge. Waits until the battle is closed.
 */
export function passKnockedOutTurn(room: GameRoom): void {
  if (room.gameStatus !== 'playing' || room.battleState) return;
  if (room.players.find((p) => p.name === room.turnState.player)?.eliminated) advanceTurn(room);
}
