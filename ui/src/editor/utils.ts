import type { DragEvent } from 'react';
import {
  CubeCoord,
  Terrain,
  Board,
  DockSpec,
  PortType,
  assignStandardHexes,
  computeAdjacency,
  coastRing,
  BOARD_RADIUS,
  LandTerrain,
  TOKENS,
  TERRAIN_COUNTS,
  shuffle,
  terrainColors,
  cubeCoordKey,
} from 'common';
import { EditorHex, EditorMap, Tactic, Target, TerrainTarget } from './types';
import { EXPANSION_TERRAIN_COUNTS, EXPANSION_TOKENS, HEX_SIZE, NUMBER_OPTIONS, TERRAIN_OPTIONS } from './constants';

/**
 * The editor's coast ring: vertices touching exactly one non-water placed
 * hex, sorted by angle — the same order `generateBoard`/`extractDocks` use,
 * so dock indices mean the same coast vertices on save.
 */
export function computeCoastRing(map: EditorMap): { x: number; y: number }[] {
  const coords = Object.values(map).map((h) => h.coord);
  if (coords.length === 0) return [];
  const { vertices } = computeAdjacency(coords, HEX_SIZE);
  return coastRing([...vertices.values()], (id) => map[id.slice(2)]?.terrain === 'Water').map(
    (v) => v.position
  );
}

/** The ring vertices a dock spans (wraps; each index mod n). */
export function dockSpanVertices(
  coast: { x: number; y: number }[],
  dock: DockSpec
): { x: number; y: number }[] {
  const n = coast.length;
  if (n === 0) return [];
  return dock.coast.slice(0, 2).map((i) => coast[((i % n) + n) % n]);
}

/**
 * Stretch/anchor a dock so it spans [s, t] around the ring. t === s shrinks
 * to a single vertex; a non-adjacent t re-anchors the span at t (the span
 * keeps its width), which makes any distant drop behave like a move.
 */
export function dockSpanTo(s: number, t: number, n: number, dock?: DockSpec): number[] {
  if (t === s) return [s];
  const wrap = (i: number) => ((i % n) + n) % n;
  const sN = wrap(s), tN = wrap(t);
  if (tN === (sN + 1) % n) return [sN, tN];
  if (tN === (sN - 1 + n) % n) return [tN, sN];
  const len = dock?.coast.length === 2 ? 2 : 1;
  return len === 2 ? [tN, (tN + 1) % n] : [tN];
}

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

/** The six land terrains the mixer draws from (Desert included; Water never). */
const LAND_TERRAINS: Terrain[] = ['Wood', 'Sheep', 'Wheat', 'Brick', 'Ore', 'Desert'];

/**
 * Build a terrain list following the standard board mix (`TERRAIN_COUNTS`,
 * land-only) scaled to exactly `count` entries, then shuffled — same
 * largest-remainder rounding as `balancedNumbers`.
 */
export function balancedTerrains(count: number): Terrain[] {
  if (count <= 0) return [];
  const weights = LAND_TERRAINS.map((t) => ({ t, w: TERRAIN_COUNTS[t as LandTerrain] }));
  const totalWeight = weights.reduce((s, x) => s + x.w, 0);
  const result: Terrain[] = [];
  const remainders: { t: Terrain; frac: number }[] = [];
  for (const { t, w } of weights) {
    const ideal = (w * count) / totalWeight;
    const whole = Math.floor(ideal);
    for (let i = 0; i < whole; i++) result.push(t);
    remainders.push({ t, frac: ideal - whole });
  }
  remainders.sort((a, b) => b.frac - a.frac);
  let remaining = count - result.length;
  for (const r of remainders) {
    if (remaining <= 0) break;
    result.push(r.t);
    remaining -= 1;
  }
  return shuffle(result);
}


/**
 * Return a new map with terrain reassigned on the hexes selected by
 * `terrainTarget`, per `tactic`:
 * - 'equal'   — TERRAIN_COUNTS ratio scaled to the target count (land only).
 * - 'random'  — a uniform land terrain per target.
 * - 'current' — the existing terrains reshuffled, padded with random land
 *               terrains when the pool runs short.
 *
 * `excludeWater` freezes water hexes as targets AND strips Water from the
 * reshuffled 'current' pool — no hex ever becomes or stops being water.
 * Roll numbers survive on hexes that stay number-capable; Desert/Water
 * results clear theirs via `applyTerrain`.
 */
export function assignTerrain(
  map: EditorMap,
  tactic: Tactic,
  terrainTarget: TerrainTarget,
  excludeWater: boolean
): EditorMap {
  const entries = Object.entries(map);
  const isWaterHex = ([, hex]: [string, EditorHex]) => hex.terrain === 'Water';
  const targets = terrainTarget === 'land only' || excludeWater
    ? entries.filter((e) => !isWaterHex(e))
    : entries;

  let pool: Terrain[];
  if (tactic === 'equal') {
    pool = balancedTerrains(targets.length);
  } else if (tactic === 'current') {
    pool = shuffle(
      entries
        .map(([, hex]) => hex.terrain)
        .filter((t) => !excludeWater || t !== 'Water')
    );
    while (pool.length < targets.length) {
      pool.push(LAND_TERRAINS[Math.floor(Math.random() * LAND_TERRAINS.length)]);
    }
    pool = pool.slice(0, targets.length);
  } else {
    pool = targets.map(() => LAND_TERRAINS[Math.floor(Math.random() * LAND_TERRAINS.length)]);
  }

  const next = { ...map };
  targets.forEach(([key], i) => {
    next[key] = applyTerrain(next[key], pool[i]);
  });
  return next;
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
export function setCustomDragImage(e: DragEvent, kind: 'terrain' | 'number' | 'port', value: Terrain | number | PortType) {
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
  } else if (kind === 'port') {
    el.style.background = value === 'generic' ? '#b8895a' : '#8a5a30';
    el.style.color = '#fff';
    el.textContent = value === 'generic' ? '3:1' : '2:1';
    el.style.fontSize = '14px';
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

/** True when a terrain can carry a roll number (Desert / Water cannot). */
export function canCarryNumber(terrain: Terrain): boolean {
  return terrain !== 'Desert' && terrain !== 'Water';
}

/**
 * Return `hex` with `terrain` applied, clearing its roll number when the new
 * terrain cannot carry one (Desert / Water).
 */
export function applyTerrain(hex: EditorHex, terrain: Terrain): EditorHex {
  return { ...hex, terrain, rollNumber: canCarryNumber(terrain) ? hex.rollNumber : null };
}



/** Number of placeable hexes still missing a roll number (blocks saving). */
export function countMissingNumbers(map: EditorMap): number {
  return Object.values(map).filter((h) => canCarryNumber(h.terrain) && h.rollNumber === null).length;
}

/** Per-terrain placed-hex counts for the palette badges. */
export function countTerrain(map: EditorMap): Record<Terrain, number> {
  return TERRAIN_OPTIONS.reduce(
    (acc, t) => ({ ...acc, [t]: Object.values(map).filter((h) => h.terrain === t).length }),
    {} as Record<Terrain, number>
  );
}

/** Per-token placed-number counts for the palette badges. */
export function countRollNumbers(map: EditorMap): Record<number, number> {
  return NUMBER_OPTIONS.reduce(
    (acc, n) => ({ ...acc, [n]: Object.values(map).filter((h) => h.rollNumber === n).length }),
    {} as Record<number, number>
  );
}

/**
 * Return a new map with roll numbers assigned to the hexes selected by
 * `target`, according to `tactic`:
 * - 'equal'   — the standard Catan token ratio scaled to the target count.
 * - 'random'  — a uniform random token per target.
 * - 'current' — the existing numbers reshuffled, padded with random tokens
 *               when there are fewer current numbers than targets.
 */
export function assignNumbers(map: EditorMap, tactic: Tactic, target: Target): EditorMap {
  // Hexes that can carry a number (not Desert/Water).
  const eligible = Object.entries(map).filter(([, hex]) => canCarryNumber(hex.terrain));
  // Narrow by target.
  let targets: [string, EditorHex][];
  if (target === 'only empty') targets = eligible.filter(([, hex]) => hex.rollNumber === null);
  else if (target === 'only filled') targets = eligible.filter(([, hex]) => hex.rollNumber !== null);
  else targets = eligible;

  // Build the number pool based on the tactic.
  let pool: number[];
  if (tactic === 'equal') {
    pool = balancedNumbers(targets.length);
  } else if (tactic === 'current') {
    pool = shuffle(
      Object.values(map)
        .filter((hex) => hex.rollNumber !== null)
        .map((hex) => hex.rollNumber as number)
    );
    // Pad with random if there are fewer current numbers than targets.
    while (pool.length < targets.length) {
      pool.push(NUMBER_OPTIONS[Math.floor(Math.random() * NUMBER_OPTIONS.length)]);
    }
    pool = pool.slice(0, targets.length);
  } else {
    // 'random'
    pool = targets.map(() => NUMBER_OPTIONS[Math.floor(Math.random() * NUMBER_OPTIONS.length)]);
  }

  const next = { ...map };
  targets.forEach(([key], i) => {
    next[key] = { ...next[key], rollNumber: pool[i] };
  });
  return next;
}

/**
 * Convert a mouse/drag event to board-space (px, py) by inverting the SVG's
 * screen transform. Using getScreenCTM (rather than scaling by rect.width/
 * rect.height) stays correct even when the container's aspect ratio doesn't
 * match the viewBox's and the renderer letterboxes the drawing.
 */
export function eventToBoardPoint(
  svg: SVGSVGElement,
  e: { clientX: number; clientY: number }
): { px: number; py: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = pt.matrixTransform(ctm.inverse());
  return { px: p.x, py: p.y };
}

/** True when the client-space point is inside the element's bounding rect. */
export function isClientPointInside(el: Element | null, e: { clientX: number; clientY: number }): boolean {
  const rect = el?.getBoundingClientRect();
  if (!rect) return false;
  return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
}
