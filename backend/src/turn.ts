import { GameRoom } from 'common';

/**
 * Advance the room's turn/phase state machine based on the current phase.
 * Mutates `room.turnState` (and `room.roll` when a new Dice phase begins).
 */
export function advanceTurn(room: GameRoom): void {
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
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[0],
          phase: 'Dice',
          offset: 0,
          placedSettlement: null,
          placedRoad: null,
        };
        room.roll = { die1: null, die2: null };
        turnState.dicePlayerIndex = 0;
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
        };
      }
      break;
    }

    case 'Dice':
      // Same player continues to Trade phase.
      room.turnState = { ...turnState, phase: 'Trade' };
      console.log('Dice rolled, moving to Trade phase');
      break;

    case 'Trade':
      // Same player continues to Build phase, reset offset for all players.
      room.turnState = { ...turnState, phase: 'Build', offset: 0 };
      break;

    case 'Build':
      if (turnState.offset === playerCount - 1) {
        // All players have built, move to Action phase with dice player.
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[turnState.dicePlayerIndex],
          phase: 'Action',
          offset: 0,
        };
      } else {
        // Next player's turn to build.
        const nextPlayerIndex = (playerIndex + 1) % playerCount;
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[nextPlayerIndex],
          offset: turnState.offset + 1,
        };
      }
      break;

    case 'Action':
      if (turnState.offset === playerCount - 1) {
        // All players have acted, move to next player's Dice phase.
        // A new round begins: clear the per-turn soldier tracking arrays.
        turnState.dicePlayerIndex = (turnState.dicePlayerIndex + 1) % playerCount;
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[turnState.dicePlayerIndex],
          phase: 'Dice',
          offset: 0,
          soldiersActedThisTurn: [],
          soldiersCreatedThisTurn: [],
          soldiersHealedThisTurn: [],
        };
        room.roll = { die1: null, die2: null };
      } else {
        // Next player's turn for action; each soldier keeps its own action limit.
        const nextPlayerIndex = (playerIndex + 1) % playerCount;
        room.turnState = {
          ...turnState,
          player: turnState.playerOrder[nextPlayerIndex],
          offset: turnState.offset + 1,
        };
      }
      break;

    default:
      throw new Error(`Invalid turn phase: ${turnState.phase}`);
  }
}
