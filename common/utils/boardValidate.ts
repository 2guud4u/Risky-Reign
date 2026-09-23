import { Terrain } from '../types/Hex';
import { HexLayout } from '../types/BoardGenerator';

/**
 * Validation for a custom board layout (shared by the UI editor and the
 * backend `joinRoom`/`editBoard` handlers). The rules engine is shape-agnostic,
 * so a layout is "valid" when it describes a well-formed set of hexes:
 *
 *  - at least one hex;
 *  - no two hexes share a coordinate;
 *  - every terrain is a known `Terrain`;
 *  - a roll number is `null` or one of the standard dice tokens;
 *  - Desert / Water carry no roll number.
 *
 * Any number of any terrain (including Desert) is allowed. Connectivity is
 * intentionally NOT a hard requirement (a player may place disconnected
 * clusters); the editor surfaces that as a warning instead.
 */

const VALID_TERRAINS: ReadonlySet<string> = new Set<string>([
  'Wheat',
  'Sheep',
  'Ore',
  'Brick',
  'Wood',
  'Water',
  'Desert',
]);

/** The standard dice tokens a hex may carry. */
export const VALID_ROLL_NUMBERS: ReadonlySet<number> = new Set<number>([
  2, 3, 4, 5, 6, 8, 9, 10, 11, 12,
]);

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

const coordKey = (c: { q: number; r: number; s: number }): string =>
  `${c.q},${c.r},${c.s}`;

/**
 * Validate a custom board layout. Returns `{ allowed: true }` when the layout
 * is well-formed, or `{ allowed: false, reason }` with the first violation.
 */
export function validateLayouts(layouts: HexLayout[]): ValidationResult {
  if (!Array.isArray(layouts) || layouts.length === 0) {
    return { allowed: false, reason: 'Board must have at least one hex' };
  }

  const seenCoords = new Set<string>();
  for (const layout of layouts) {
    const { coord, terrain, rollNumber } = layout;

    if (!coord || typeof coord.q !== 'number' || typeof coord.r !== 'number' || typeof coord.s !== 'number') {
      return { allowed: false, reason: 'Every hex needs a valid cube coordinate' };
    }

    const key = coordKey(coord);
    if (seenCoords.has(key)) {
      return { allowed: false, reason: `Duplicate hex at ${key}` };
    }
    seenCoords.add(key);

    if (!VALID_TERRAINS.has(terrain)) {
      return { allowed: false, reason: `Unknown terrain: ${String(terrain)}` };
    }

    if (rollNumber !== null && !VALID_ROLL_NUMBERS.has(rollNumber)) {
      return { allowed: false, reason: `Invalid roll number: ${String(rollNumber)}` };
    }

    if ((terrain === 'Desert' || terrain === 'Water') && rollNumber !== null) {
      return { allowed: false, reason: `${terrain} hexes cannot carry a roll number` };
    }
  }

  return { allowed: true };
}

/**
 * True when the placed hexes form a single connected region (flood-fill over
 * hex adjacency). Used by the editor to surface a warning (not a hard block).
 */
export function isLayoutConnected(layouts: HexLayout[]): boolean {
  if (layouts.length <= 1) return true;

  const key = (c: { q: number; r: number; s: number }) => `${c.q},${c.r},${c.s}`;
  const coords = new Map<string, { q: number; r: number; s: number }>();
  for (const l of layouts) coords.set(key(l.coord), l.coord);

  // The six cube directions (q, r, s deltas).
  const DIRS: ReadonlyArray<[number, number, number]> = [
    [1, -1, 0], [1, 0, -1], [0, 1, -1],
    [-1, 1, 0], [-1, 0, 1], [0, -1, 1],
  ];

  const start = key(layouts[0].coord);
  const visited = new Set<string>([start]);
  const stack = [layouts[0].coord];
  while (stack.length) {
    const c = stack.pop() as { q: number; r: number; s: number };
    for (const [dq, dr, ds] of DIRS) {
      const nq = c.q + dq;
      const nr = c.r + dr;
      const ns = c.s + ds;
      const k = `${nq},${nr},${ns}`;
      if (coords.has(k) && !visited.has(k)) {
        visited.add(k);
        stack.push({ q: nq, r: nr, s: ns });
      }
    }
  }
  return visited.size === coords.size;
}
