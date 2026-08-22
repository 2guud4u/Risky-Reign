/**
 * Shared constants for the clean v2 layer.
 *
 * `process` is declared locally so this module type-checks without @types/node
 * (the browser build gets real values via CRA's DefinePlugin).
 */
declare const process: { env?: { [key: string]: string | undefined } } | undefined;

/** Hex render size (px) used during active play (matches legacy common). */
export const GAME_HEX_SIZE = 100;

/** Hex render size (px) used on the lobby / waiting screen (matches legacy). */
export const LOBBY_HEX_SIZE = 50;

/** Radius of the standard Catan board (19 hexes, 54 vertices, 72 edges). */
export const BOARD_RADIUS = 2;

/** The five resource types, in canonical display order. */
export const RESOURCES = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'] as const;

/** Default socket server url (override with REACT_APP_SOCKET_URL). */
export const SOCKET_URL: string =
  (typeof process !== 'undefined' && process && process.env && process.env.REACT_APP_SOCKET_URL) ||
  'http://localhost:3001';
