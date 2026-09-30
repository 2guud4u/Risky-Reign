/**
 * Player-color rules shared by the UI (picker hints) and the backend (the
 * authoritative check). Players may pick any `#rrggbb` color, as long as it is
 * visually distinct from every other player's color.
 */

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Minimum RGB distance (0–441) between two players' colors. Below this,
 * pieces on the board are hard to tell apart.
 */
export const MIN_COLOR_DISTANCE = 60;

/** Whether `color` is a `#rrggbb` hex color. */
export function isHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color);
}

/** Lowercase `#rrggbb` form, so colors compare consistently. */
export function normalizeColor(color: string): string {
  return color.toLowerCase();
}

function rgb(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Euclidean distance between two `#rrggbb` colors in RGB space. */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/**
 * Validate a requested player color against the colors other players hold.
 * Returns an error message, or null when the color is allowed.
 */
export function playerColorError(color: string, othersColors: string[]): string | null {
  if (!isHexColor(color)) return 'Invalid color';
  const tooClose = othersColors.some(
    (other) => isHexColor(other) && colorDistance(color, other) < MIN_COLOR_DISTANCE
  );
  return tooClose ? 'Too similar to another player\u2019s color' : null;
}
