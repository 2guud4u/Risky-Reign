import { CubeCoord, Terrain } from 'common';

/**
 * A single placed hex in the board editor draft.
 */
export interface EditorHex {
  coord: CubeCoord;
  terrain: Terrain;
  rollNumber: number | null;
}

/**
 * The editor's working state: a sparse map of placed hexes, keyed by the
 * canonical cube-coord string (e.g. "0,0,0").
 */
export type EditorMap = Record<string, EditorHex>;

/**
 * Convert an `EditorMap` to the `HexLayout[]` shape the backend expects.
 */
export function toHexLayouts(map: EditorMap): { coord: CubeCoord; terrain: string; rollNumber: number | null }[] {
  return Object.values(map).map((h) => ({ coord: h.coord, terrain: h.terrain, rollNumber: h.rollNumber }));
}

/**
 * Canonical cube-coord string key (matches `cubeCoordKey` in common).
 */
export const coordKey = (c: CubeCoord): string => `${c.q},${c.r},${c.s}`;
