import { Terrain, VALID_ROLL_NUMBERS, LOBBY_HEX_SIZE } from 'common';

/** Terrain palette order for the editor toolbar. */
export const TERRAIN_OPTIONS: Terrain[] = ['Wood', 'Sheep', 'Wheat', 'Brick', 'Ore', 'Desert', 'Water'];

/** Standard dice tokens a hex may carry (sourced from common). */
export const NUMBER_OPTIONS = [...VALID_ROLL_NUMBERS];

/** 5-6 player expansion terrain breakdown (30 tiles, no Water). */
export const EXPANSION_TERRAIN_COUNTS: Record<Terrain, number> = {
  Wood: 6,
  Sheep: 6,
  Wheat: 6,
  Brick: 5,
  Ore: 5,
  Desert: 2,
  Water: 0,
  Nothing: 0,
};

/** 5-6 player expansion token distribution (28 tokens for the 28 resource hexes). */
export const EXPANSION_TOKENS: Record<number, number> = {
  2: 2,
  3: 3,
  4: 3,
  5: 3,
  6: 3,
  8: 3,
  9: 3,
  10: 3,
  11: 3,
  12: 2,
};

/** Shared input styling for the editor's form fields. */
export const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm';

/** Board units per hex in the editor canvas (matches the lobby board size). */
export const HEX_SIZE = LOBBY_HEX_SIZE;
/** Window radius around the view center (infinite grid). */
export const GRID_RADIUS = 8;
/** Screen px before a drag becomes a pan. */
export const PAN_THRESHOLD = 5;
/** Board units; click within this of a hex center grabs its number. */
export const TOKEN_RADIUS = 16;
