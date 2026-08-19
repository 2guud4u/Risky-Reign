/**
 * Terrain / resource type definitions. Types only — the token/terrain data
 * and `assignStandardHexes` live in `utils/hex.ts`.
 */

export type Resource = 'Wheat' | 'Sheep' | 'Ore' | 'Brick' | 'Wood' | 'Nothing';
export type Terrain = Resource | 'Water' | 'Desert';

/** A terrain that can carry a token (everything except Water). */
export type LandTerrain = 'Wheat' | 'Sheep' | 'Ore' | 'Brick' | 'Wood' | 'Desert';
