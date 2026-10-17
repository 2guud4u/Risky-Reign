import { PixelCoord } from 'common';

/**
 * Pure helpers for board pointer interaction: screen-to-SVG coordinate
 * conversion and nearest-target drop resolution. The rule questions (who
 * may move, which hexes/vertices are targets) live in `board/selectors.ts`.
 */

/**
 * Convert a mouse event to SVG world coordinates using the element's current
 * transform matrix (so pan/zoom are accounted for).
 */
export function mouseToSvgPoint(
  e: { clientX: number; clientY: number },
  svg: SVGSVGElement | null
): PixelCoord | null {
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/**
 * The nearest item (by `positionOf`) to `pos`, within `maxDist`. Items whose
 * position resolves to null are skipped (e.g. a stale vertex id).
 */
export function nearestWithin<T>(
  items: Iterable<T>,
  pos: PixelCoord,
  maxDist: number,
  positionOf: (item: T) => PixelCoord | null
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const p = positionOf(item);
    if (!p) continue;
    const d = Math.hypot(p.x - pos.x, p.y - pos.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best !== null && bestDist <= maxDist ? best : null;
}
