import { CubeCoord } from '../types/Coordinates';
import { Terrain } from '../types/Hex';
import { TOKENS, TERRAIN_COUNTS } from '../Constant';

/**
 * Board-terrain assignment (pure code). The terrain / token data lives in
 * `Constant.ts`; the `Terrain` type lives in `types/Hex.ts`.
 */

/**
 * Assign standard terrain + tokens to the hexes of a radius-`boardRadius`
 * board. The single Desert always lands on the center hex; every other hex
 * gets a shuffled terrain and a shuffled token.
 */
export function assignStandardHexes(
  boardRadius: number
): { coord: CubeCoord; terrain: Terrain; rollNumber: number | null }[] {
  const coords: CubeCoord[] = [];
  for (let q = -boardRadius; q <= boardRadius; q++) {
    for (let r = Math.max(-boardRadius, -q - boardRadius); r <= Math.min(boardRadius, -q + boardRadius); r++) {
      coords.push({ q, r, s: -q - r });
    }
  }

  const terrains: Terrain[] = [];
  (Object.keys(TERRAIN_COUNTS) as (keyof typeof TERRAIN_COUNTS)[]).forEach((t) => {
    if (t === 'Desert') return; // the center hex is always the Desert
    for (let i = 0; i < TERRAIN_COUNTS[t]; i++) terrains.push(t);
  });
  const tokens: number[] = [];
  Object.keys(TOKENS).forEach((k) => {
    const n = TOKENS[Number(k)];
    for (let i = 0; i < n; i++) tokens.push(Number(k));
  });

  const shuffledTerrains = shuffle(terrains);
  const shuffledTokens = shuffle(tokens);

  return coords.map((coord) => {
    const isCenter = coord.q === 0 && coord.r === 0;
    if (isCenter) {
      return { coord, terrain: 'Desert' as Terrain, rollNumber: null };
    }
    const terrain = shuffledTerrains.pop() as Terrain;
    const rollNumber = shuffledTokens.pop() as number;
    return { coord, terrain, rollNumber };
  });
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
