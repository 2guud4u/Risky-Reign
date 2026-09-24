import {
  Board,
  GameRoom,
  ResourceCount,
  GAME_HEX_SIZE,
  BANK_SUPPLY_PER_RESOURCE,
  DEFAULT_POINTS_TO_WIN,
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

/** A resource count with every resource set to `value` (0 for a fresh bag, 10 for a fresh hand). */
export function freshResourceCount(value: number): ResourceCount {
  return {
    Wood: value,
    Brick: value,
    Sheep: value,
    Wheat: value,
    Ore: value,
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
    pointsToWin: DEFAULT_POINTS_TO_WIN,
    winner: null,
    tradeOffers: [],
    battleState: null,
    devCardDeck: generateDevelopmentCardDeck(),
    roll: { die1: null, die2: null },
    robberMove: null,
    robberDefeatedBy: null,
    steal: null,
    devCardChoice: null,
    discards: {},
    robberBag: freshResourceCount(0),
    bankSupply: freshBankSupply(),
    bonuses: emptyBonuses(),
  };
  gameRooms.set(roomId, room);
  return room;
}

/**
 * Reset a room to a fresh game state (same shape as a newly created room),
 * keeping the existing players and their identity (id/name/color). Used by
 * "Play Again" after a game ends. Resets the board, turn machine, all
 * per-player resources/VP/cards, the dev-card deck, and every pending
 * game state so a new game starts clean.
 */
export function resetRoom(room: GameRoom): void {
  room.board = createBoard();
  room.turnState = {
    phase: 'SetUp',
    player: room.players[0]?.name ?? 'X',
    playerOrder: room.players.map((p) => p.name),
    offset: 0,
    dicePlayerIndex: 0,
    placedSettlement: false,
    placedRoad: false,
    soldiersActedThisTurn: [],
    soldiersCreatedThisTurn: [],
    soldiersHealedThisTurn: [],
    robberFoughtThisPhase: [],
    undoLog: [],
  };
  room.winner = null;
  room.tradeOffers = [];
  room.battleState = null;
  room.devCardDeck = generateDevelopmentCardDeck();
  room.roll = { die1: null, die2: null };
  room.robberMove = null;
  room.robberDefeatedBy = null;
  room.steal = null;
  room.devCardChoice = null;
  room.discards = {};
  room.robberBag = freshResourceCount(0);
  room.bankSupply = freshBankSupply();
  room.bonuses = emptyBonuses();
  for (const p of room.players) {
    p.resources = freshResourceCount(10);
    p.victoryPoints = 0;
    p.developmentCards = [];
    p.freeRoadsLeft = 0;
    p.devCardsBoughtThisTurn = 0;
    p.bankTradesThisTurn = freshResourceCount(0);
  }
}

/** Look up a room by id. */
export function getRoom(roomId: string): GameRoom | undefined {
  return gameRooms.get(roomId);
}
