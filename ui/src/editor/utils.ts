import type { DragEvent } from 'react';
import {
  CubeCoord,
  Terrain,
  Board,
  assignStandardHexes,
  BOARD_RADIUS,
  TOKENS,
  shuffle,
  terrainColors,
  cubeCoordKey,
} from 'common';
import { EditorMap } from './types';
import { EXPANSION_TERRAIN_COUNTS, EXPANSION_TOKENS } from './constants';

/** Canonical cube-coord string key — re-export of `cubeCoordKey` from common. */
export const coordKey = cubeCoordKey;

/**
 * Convert an `EditorMap` to the `HexLayout[]` shape the backend expects.
 */
export function toHexLayouts(map: EditorMap): { coord: CubeCoord; terrain: string; rollNumber: number | null }[] {
  return Object.values(map).map((h) => ({ coord: h.coord, terrain: h.terrain, rollNumber: h.rollNumber }));
}

/**
 * Build a number list that follows the standard Catan token ratio
 * (the `TOKENS` weights), scaled to exactly `count` entries, then shuffled.
 * Uses largest-remainder rounding so the total is always exactly `count`.
 */
export function balancedNumbers(count: number): number[] {
  if (count <= 0) return [];
  const weights = Object.entries(TOKENS).map(([n, w]) => ({ n: Number(n), w }));
  const totalWeight = weights.reduce((s, x) => s + x.w, 0);
  const result: number[] = [];
  const remainders: { n: number; frac: number }[] = [];
  for (const { n, w } of weights) {
    const ideal = (w * count) / totalWeight;
    const whole = Math.floor(ideal);
    for (let i = 0; i < whole; i++) result.push(n);
    remainders.push({ n, frac: ideal - whole });
  }
  remainders.sort((a, b) => b.frac - a.frac);
  let remaining = count - result.length;
  for (const r of remainders) {
    if (remaining <= 0) break;
    result.push(r.n);
    remaining -= 1;
  }
  return shuffle(result);
}

/** Seed an EditorMap from a fresh standard board. */
export function standardBoardMap(): EditorMap {
  const map: EditorMap = {};
  for (const h of assignStandardHexes(BOARD_RADIUS)) {
    map[coordKey(h.coord)] = { coord: h.coord, terrain: h.terrain, rollNumber: h.rollNumber };
  }
  return map;
}

/** Seed an EditorMap from an existing board. */
export function boardToMap(board: Board): EditorMap {
  const map: EditorMap = {};
  for (const h of Object.values(board.hexes)) {
    map[coordKey(h.coord)] = { coord: h.coord, terrain: h.terrain as Terrain, rollNumber: h.rollNumber };
  }
  return map;
}

/**
 * The 5-6 player expansion island: an elongated hex with 7 rows of
 * 3-4-5-6-5-4-3 (30 hexes). Uses r = -2..4 so the even/odd row parity
 * matches the odd/even row sizes (required for integer axial coords).
 */
export function expansionCoords(): CubeCoord[] {
  // q-range [start, end] for each row (r = -2..4), centered on x = 0.
  const rowQRanges: Array<[number, number]> = [
    [0, 2], // r=-2, 3 hexes
    [-1, 2], // r=-1, 4 hexes
    [-2, 2], // r=0, 5 hexes
    [-3, 2], // r=1, 6 hexes
    [-3, 1], // r=2, 5 hexes
    [-3, 0], // r=3, 4 hexes
    [-3, -1], // r=4, 3 hexes
  ];
  const coords: CubeCoord[] = [];
  rowQRanges.forEach(([qStart, qEnd], i) => {
    const r = i - 2;
    for (let q = qStart; q <= qEnd; q++) {
      coords.push({ q, r, s: -q - r });
    }
  });
  return coords;
}

/** Seed an EditorMap from the 5-6 player expansion layout (shuffled terrain + tokens). */
export function expansionBoardMap(): EditorMap {
  const coords = expansionCoords();
  const terrains: Terrain[] = [];
  (Object.keys(EXPANSION_TERRAIN_COUNTS) as Terrain[]).forEach((t) => {
    for (let i = 0; i < EXPANSION_TERRAIN_COUNTS[t]; i++) terrains.push(t);
  });
  const shuffledTerrains = shuffle(terrains);
  const tokens: number[] = [];
  Object.keys(EXPANSION_TOKENS).forEach((k) => {
    const n = EXPANSION_TOKENS[Number(k)];
    for (let i = 0; i < n; i++) tokens.push(Number(k));
  });
  const shuffledTokens = shuffle(tokens);

  const map: EditorMap = {};
  let tokenIdx = 0;
  coords.forEach((coord, i) => {
    const terrain = shuffledTerrains[i];
    // Desert / Water cannot carry a number.
    const rollNumber = terrain === 'Desert' || terrain === 'Water' ? null : shuffledTokens[tokenIdx++];
    map[coordKey(coord)] = { coord, terrain, rollNumber };
  });
  return map;
}

/**
 * Set a small, clean drag image so the browser's drag ghost is a tidy token
 * (a colored dot for terrain, a number token for numbers) instead of a
 * snapshot of the whole toolbar item / board.
 */
export function setCustomDragImage(e: DragEvent, kind: 'terrain' | 'number', value: Terrain | number) {
  const el = document.createElement('div');
  el.style.width = '44px';
  el.style.height = '44px';
  el.style.borderRadius = '50%';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.fontWeight = 'bold';
  el.style.fontSize = '20px';
  el.style.border = '2px solid #111';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  if (kind === 'terrain') {
    el.style.background = terrainColors[value as Terrain] ?? '#eee';
  } else {
    el.style.background = '#fff';
    el.textContent = String(value);
  }
  document.body.appendChild(el);
  e.dataTransfer.setDragImage(el, 22, 22);
  window.setTimeout(() => el.remove(), 0);
}

/** Inverse of cubeToPixel, with cube rounding to the nearest hex center. */
export function pixelToCube(px: number, py: number, size: number): CubeCoord {
  const r = (2 / 3) * (py / size);
  const q = px / (size * Math.sqrt(3)) - r / 2;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(-q - r);
  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - (-q - r));
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr, s: -rq - rr };
}
