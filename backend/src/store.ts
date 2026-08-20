import { Board, GameRoom, generateStandardBoard } from 'common';

/** Board projection size (px) — must match the UI's GAME_HEX_SIZE. */
const HEX_SIZE = 100;

/** In-memory store of active game rooms. */
export const gameRooms = new Map<string, GameRoom>();

/** Build a fresh standard board. */
export function createBoard(): Board {
  return generateStandardBoard(HEX_SIZE);
}

/** Create (and register) a new game room for the first player. */
export function createGameRoom(roomId: string, firstPlayerName: string): GameRoom {
  const room: GameRoom = {
    id: roomId,
    players: [],
    board: createBoard(),
    turnState: {
      phase: 'SetUp',
      player: firstPlayerName,
      playerOrder: [firstPlayerName],
      offset: 0,
      dicePlayerIndex: 0,
      placedSettlement: false,
      placedRoad: false,
    },
    gameStatus: 'waiting',
    winner: null,
    tradeStates: [],
    battleState: null,
    roll: { die1: null, die2: null },
  };
  gameRooms.set(roomId, room);
  return room;
}

/** Look up a room by id. */
export function getRoom(roomId: string): GameRoom | undefined {
  return gameRooms.get(roomId);
}
