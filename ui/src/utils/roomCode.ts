import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH } from 'common';

/**
 * Generate an unguessable room code: ROOM_CODE_LENGTH characters drawn from
 * ROOM_CODE_CHARS using crypto-grade randomness. Rejection sampling keeps
 * every char equally likely (256 is not a multiple of the alphabet size).
 */
export function generateRoomCode(): string {
  const alphabet = ROOM_CODE_CHARS;
  const usable = Math.floor(256 / alphabet.length) * alphabet.length;
  const bytes = new Uint8Array(ROOM_CODE_LENGTH * 2);
  let code = '';
  while (code.length < ROOM_CODE_LENGTH) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < usable) code += alphabet[b % alphabet.length];
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }
  return code;
}
