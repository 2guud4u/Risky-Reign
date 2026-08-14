/** Hex render size (px) used on the lobby / waiting screen. */
export const LOBBY_HEX_SIZE = 40;

/** Hex render size (px) used during active play. */
export const GAME_HEX_SIZE = 50;

/** Default socket server url (override with REACT_APP_SOCKET_URL). */
export const SOCKET_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SOCKET_URL) ||
  'http://localhost:3001';
