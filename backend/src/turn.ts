import { GameRoom } from 'common';
import { freshResourceCount } from './store';

/**
 * Advance the room's turn/phase state machine based on the current phase.
 * Mutates `room.turnState` (and `room.roll` when a new Dice phase begins).
 */
export function advanceTurn(room: GameRoom): void {
  // A finished game never advances: the turn machine is frozen at the
  // moment the win condition is met.
  if (room.gameStatus === 'finished') return;
  const turnState = room.turnState;
  const playerCount = turnState.playerOrder.length;
  const playerIndex = turnState.playerOrder.indexOf(turnState.player);

  // Initialize dicePlayerIndex if missing.
  if (!turnState.dicePlayerIndex && turnState.dicePlayerIndex !== 0) {
    turnState.dicePlayerIndex = 0;
  }

  switch (turnState.phase) {
    case 'SetUp': {
      // Each player does setup twice (two setup turns, one settlement + one
      // road per turn). First round clockwise, second round counterclockwise.
      const totalSetupTurns = playerCount * 2;

      if (turnState.offset === totalSetupTurns - 1) {
        // Setup complete, start dice phase with first player.
        // A new round begins: clear the per-round soldier restrictions (Rule 24/25)
        // so soldiers garrisoned during setup can move in the first Action phase.
        // The per-action-phase action count resets when the Action phase begins.
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[0],
          phase: 'Dice',
          offset: 0,
          placedSettlement: null,
          placedRoad: null,
          soldiersCreatedThisTurn: [],
          soldiersHealedThisTurn: [],
          undoLog: [],
        };
        room.roll = { die1: null, die2: null };
        turnState.dicePlayerIndex = 0;
        // A new round: bank-trade counts reset (per-turn limit).
        for (const p of room.players) p.bankTradesThisTurn = freshResourceCount(0);
      } else {
        // Determine next player based on setup round.
        let nextPlayerIndex;
        const nextOffset = turnState.offset + 1;

        if (nextOffset < playerCount) {
          // First round: clockwise (A→B→C).
          nextPlayerIndex = nextOffset;
        } else {
          // Second round: counterclockwise (C→B→A).
          const positionInSecondRound = nextOffset - playerCount;
          nextPlayerIndex = playerCount - 1 - positionInSecondRound;
        }

        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[nextPlayerIndex],
          offset: nextOffset,
          placedSettlement: false,
          placedRoad: false,
          undoLog: [],
        };
      }
      break;
    }

    case 'Dice':
      // Same player continues to Build phase, reset offset for all players.
      room.turnState = { ...turnState, phase: 'Build', offset: 0, undoLog: [] };
      break;

    case 'Build':
      if (turnState.offset === playerCount - 1) {
        // All players have built, move to Action phase with dice player.
        // A new Action phase begins: reset the per-soldier action count.
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[turnState.dicePlayerIndex],
          phase: 'Action',
          offset: 0,
          soldiersActedThisTurn: [],
          robberFoughtThisPhase: [],
          undoLog: [],
        };
      } else {
        // Next player's turn to build.
        const nextPlayerIndex = (playerIndex + 1) % playerCount;
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[nextPlayerIndex],
          offset: turnState.offset + 1,
          undoLog: [],
        };
      }
      break;

    case 'Action':
      // The robber-move option belongs to the Action phase it was won in.
      room.robberDefeatedBy = null;
      if (turnState.offset === playerCount - 1) {
        // All players have acted, move to next player's Dice phase.
        // A new round begins: clear the per-round soldier restrictions (Rule 24/25).
        turnState.dicePlayerIndex = (turnState.dicePlayerIndex + 1) % playerCount;
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[turnState.dicePlayerIndex],
          phase: 'Dice',
          offset: 0,
          soldiersCreatedThisTurn: [],
          soldiersHealedThisTurn: [],
          undoLog: [],
        };
        room.roll = { die1: null, die2: null };
        // A new round: cards bought last turn are now playable.
        for (const p of room.players) p.devCardsBoughtThisTurn = 0;
        // A new round: bank-trade counts reset (per-turn limit).
        for (const p of room.players) p.bankTradesThisTurn = freshResourceCount(0);
      } else {
        // Next player's turn for action; each soldier keeps its own action limit.
        const nextPlayerIndex = (playerIndex + 1) % playerCount;
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[nextPlayerIndex],
          offset: turnState.offset + 1,
          undoLog: [],
        };
      }
      break;

    default:
      throw new Error(`Invalid turn phase: ${turnState.phase}`);
  }
}
