import {
  Board,
  GameRoom,
  ResourceCount,
  GAME_HEX_SIZE,
  BANK_SUPPLY_PER_RESOURCE,
  generateStandardBoard,
  generateDevelopmentCardDeck,
} from 'common';

/** Empty bonuses map for a fresh room (recomputed on every broadcast). */
export function emptyBonuses() {
  return {
    longestRoad: {},
    largestArmy: {},
    hasLongestRoad: {},
    hasLargestArmy: {},
    settlementVp: {},
  };
}

/** A fresh bank supply: 19 of each resource (the official 95-card bank). */
export function freshBankSupply(): ResourceCount {
  return {
    Wood: BANK_SUPPLY_PER_RESOURCE,
    Brick: BANK_SUPPLY_PER_RESOURCE,
    Sheep: BANK_SUPPLY_PER_RESOURCE,
    Wheat: BANK_SUPPLY_PER_RESOURCE,
    Ore: BANK_SUPPLY_PER_RESOURCE,
  };
}

/** In-memory store of active game rooms. */
export const gameRooms = new Map<string, GameRoom>();

/** Build a fresh standard board (projection size shared with the UI). */
export function createBoard(): Board {
  return generateStandardBoard(GAME_HEX_SIZE);
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
      soldiersActedThisTurn: [],
      soldiersCreatedThisTurn: [],
      soldiersHealedThisTurn: [],
      robberFoughtThisPhase: [],
      undoLog: [],
    },
    gameStatus: 'waiting',
    winner: null,
    tradeOffers: [],
    battleState: null,
    devCardDeck: generateDevelopmentCardDeck(),
    roll: { die1: null, die2: null },
    robberMove: null,
    steal: null,
    devCardChoice: null,
    discards: {},
    robberBag: { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 },
    bankSupply: freshBankSupply(),
    bonuses: emptyBonuses(),
  };
  gameRooms.set(roomId, room);
  return room;
}

/** Look up a room by id. */
export function getRoom(roomId: string): GameRoom | undefined {
  return gameRooms.get(roomId);
}
