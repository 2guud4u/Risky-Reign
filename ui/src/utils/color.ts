/**
 * Color helpers for tinting shared art with a player's chosen color.
 */

/**
 * Returns a darker version of a hex color by scaling its RGB channels by `factor`
 * (0 = black, 1 = unchanged). Used to derive a "shadow" tone from a player color.
 */
export function darkenColor(hex: string, factor = 0.5): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n * factor)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
