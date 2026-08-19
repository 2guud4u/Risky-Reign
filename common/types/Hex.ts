import { CubeCoord } from './Coordinates';

export type Resource = 'Wheat' | 'Sheep' | 'Ore' | 'Brick' | 'Wood' | 'Nothing';
export type Terrain = Resource | 'Water' | 'Desert';

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

/** A terrain that can carry a token (everything except Water). */
export type LandTerrain = 'Wheat' | 'Sheep' | 'Ore' | 'Brick' | 'Wood' | 'Desert';

/** Standard terrain counts for a 19-hex board (Water excluded). */
export const TERRAIN_COUNTS: Record<LandTerrain, number> = {
  Wheat: 4,
  Sheep: 4,
  Ore: 3,
  Desert: 1,
  Brick: 3,
  Wood: 4,
};

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

export const terrainColors: Record<string, string> = {
  Wood: '#228B22',
  Sheep: '#7CFC00',
  Wheat: '#FFD700',
  Brick: '#CD853F',
  Ore: '#A9A9A9',
  Desert: '#F4A460',
  Water: '#00FFFF',
};

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
