/**
 * Presentation geometry shared by the board SVG renderers (Hexagon, MiniView).
 *
 * These are pure, side-effect-free helpers that only produce SVG output, so
 * they belong in the UI layer rather than `common/` (domain projection lives
 * in `common/adapters/boardAdapter.ts`).
 */

/** Unit-offset corners of a hexagon (radius 1), top vertex first, clockwise. */
export const HEX_CORNER_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [Math.sqrt(3) / 2, -0.5],
  [Math.sqrt(3) / 2, 0.5],
  [0, 1],
  [-Math.sqrt(3) / 2, 0.5],
  [-Math.sqrt(3) / 2, -0.5],
];

/**
 * SVG `points` string for a hexagon centered at (x, y) with the given radius,
 * rounded to one decimal place.
 */
export const hexPointsAt = (x: number, y: number, size: number): string =>
  HEX_CORNER_OFFSETS.map(
    ([px, py]) => `${(px * size + x).toFixed(1)},${(py * size + y).toFixed(1)}`
  ).join(' ');
