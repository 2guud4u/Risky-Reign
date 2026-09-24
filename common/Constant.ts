/**
 * Shared constants for the clean v2 layer.
 *
 * `process` is declared locally so this module type-checks without @types/node
 * (the browser build gets real values via CRA's DefinePlugin).
 */
declare const process: { env?: { [key: string]: string | undefined } } | undefined;
import { Price } from './types/Logic';
import { Resource, Terrain, LandTerrain } from './types/Hex';

/** Hex render size (px) used during active play (matches legacy common). */
export const GAME_HEX_SIZE = 100;

/** Hex render size (px) used on the lobby / waiting screen (matches legacy). */
export const LOBBY_HEX_SIZE = 50;

/** Radius of the standard Catan board (19 hexes, 54 vertices, 72 edges). */
export const BOARD_RADIUS = 2;

/** The five resource types, in canonical display order. */
export const RESOURCES = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'] as const;

/** Maximum number of players in a room. */
export const MAX_PLAYERS = 10;
/** Minimum number of players required to start a game. */
export const MIN_PLAYERS = 2;

/** Default victory threshold (standard Catan: first to 10 VP wins). */
export const DEFAULT_POINTS_TO_WIN = 10;

/** Default socket server url (override with REACT_APP_SOCKET_URL). */
export const SOCKET_URL: string =
  (typeof process !== 'undefined' && process && process.env && process.env.REACT_APP_SOCKET_URL) ||
  'http://localhost:3001';

/** Settlement build cost. */
export const SettlementPrice: Price = { Wood: 1, Brick: 1, Sheep: 1, Wheat: 1, Ore: 0 };
/** Road build cost. */
export const RoadPrice: Price = { Wood: 1, Brick: 1, Sheep: 0, Wheat: 0, Ore: 0 };
/** Soldier build cost. */
export const SoldierPrice: Price = { Wood: 0, Brick: 0, Sheep: 1, Wheat: 1, Ore: 0 };
/** City upgrade cost. */
export const CityPrice: Price = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 2, Ore: 3 };
/** Cost to buy a development card (standard Catan price). */
export const DevelopmentCardPrice: Price = { Wood: 0, Brick: 1, Sheep: 0, Wheat: 1, Ore: 1 };

/**
 * Healing cost: twice the soldier creation cost (Rules.md line 27: "paying 2 of
 * each card used to create the soldier. No duplicates.").
 */
export const HealSoldierPrice: Price = { Wood: 0, Brick: 0, Sheep: 2, Wheat: 2, Ore: 0 };

/** Default player color palette, cycled by join order when a player picks none. */
export const PLAYER_COLORS: string[] = [
  '#e6194B',
  '#3cb44b',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#42d4f4',
  '#f032e6',
  '#bfef45',
  '#469990',
  '#ee8434',
];

/** Standard Catan token distribution (roll -> count). */
export const TOKENS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  8: 2,
  9: 2,
  10: 2,
  11: 2,
  12: 1,
};

/** Standard terrain counts for a 19-hex board (Water excluded). */
export const TERRAIN_COUNTS: Record<LandTerrain, number> = {
  Wheat: 4,
  Sheep: 4,
  Ore: 3,
  Desert: 1,
  Brick: 3,
  Wood: 4,
};

/** Map from terrain to the resource it produces. */
export const TerrainResourceMap: Record<Terrain, Resource> = {
  Wheat: 'Wheat',
  Sheep: 'Sheep',
  Ore: 'Ore',
  Brick: 'Brick',
  Wood: 'Wood',
  Water: 'Nothing',
  Desert: 'Nothing',
  Nothing: 'Nothing',
};

/** Hex fill colors per terrain (used by the UI). */
export const terrainColors: Record<string, string> = {
  Wood: '#228B22',
  Sheep: '#7CFC00',
  Wheat: '#FFD700',
  Brick: '#CD853F',
  Ore: '#A9A9A9',
  Desert: '#F4A460',
  Water: '#00FFFF',
};

/** Minimum road count for the Longest Road bonus. */
export const LONGEST_ROAD_MIN = 5;
/** Minimum soldier count for the Largest Army bonus. */
export const LARGEST_ARMY_MIN = 3;
/** Victory points awarded by each bonus. */
export const BONUS_VP = 2;
/** Victory points needed to win the game (standard Catan: first to 10 VP on your turn). */
export const WIN_VP = 10;

/**
 * Official piece-pool limits per player: a maximum of 5 settlements, 4 cities
 * (a city is an upgraded settlement, so it also occupies a settlement slot)
 * and 15 roads.
 */
export const MAX_SETTLEMENTS = 5;
export const MAX_CITIES = 4;
export const MAX_ROADS = 15;

/** The bank holds this many cards of each resource (95 total, official). */
export const BANK_SUPPLY_PER_RESOURCE = 19;

/** A player may trade at most this many of one resource type per turn (official). */
export const MAX_BANK_TRADE_PER_TURN = 4;

/** Maximum soldiers that may fight on a side in a single battle round. */
export const MAX_PER_ROUND = 3;
