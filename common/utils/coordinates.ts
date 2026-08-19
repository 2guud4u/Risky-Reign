import { CubeCoord, PixelCoord } from '../types/Coordinates';

/**
 * Coordinate helpers (pure code). The `CubeCoord` / `PixelCoord` types live in
 * `types/Coordinates.ts`.
 */

/** Compare two cube coords lexicographically (q, then r, then s). */
export function compareCubeCoords(a: CubeCoord, b: CubeCoord): number {
  if (a.q !== b.q) return a.q - b.q;
  if (a.r !== b.r) return a.r - b.r;
  return a.s - b.s;
}

/** Canonical string form of a single cube coordinate, e.g. "0,0,0". */
export function cubeCoordKey(c: CubeCoord): string {
  return `${c.q},${c.r},${c.s}`;
}

/** Canonical hex id from its cube coordinate, e.g. "h_0,0,0". */
export function hexId(c: CubeCoord): string {
  return `h_${cubeCoordKey(c)}`;
}

/**
 * Canonical vertex id from the EXACT corner position (Xb, Ya).
 *
 * This is the correct canonical form: a physical vertex is a geometric point,
 * and (Xb, Ya) uniquely identifies it. It is deterministic and independent of
 * hex order or which adjacent hex you start from.
 * @param Xb - exact x coefficient (x = size * Xb * √3 / 2)
 * @param Ya - exact y coefficient (y = size * Ya / 2)
 */
export function exactVertexId(Xb: number, Ya: number): string {
  return `v_${Xb}_${Ya}`;
}

/**
 * Canonical edge id from its two endpoint vertex ids (order-independent).
 * @param vertexAId - one endpoint vertex id
 * @param vertexBId - the other endpoint vertex id
 */
export function canonicalEdgeId(vertexAId: string, vertexBId: string): string {
  const [a, b] = [vertexAId, vertexBId].sort();
  return `e_${a}_${b}`;
}

/**
 * Pointy-top hex: cube -> pixel (center of the hex).
 * x = size * (sqrt(3) * q + sqrt(3)/2 * r)
 * y = size * (3/2 * r)
 */
export function cubeToPixel(c: CubeCoord, size: number): PixelCoord {
  const x = size * (Math.sqrt(3) * c.q + (Math.sqrt(3) / 2) * c.r);
  const y = size * (1.5 * c.r);
  return { x, y };
}

/**
 * The 6 corner (vertex) pixel positions of a pointy-top hex, in clockwise
 * order starting from the top corner. Corner k sits at angle (60k - 30) degrees.
 */
export function hexCorners(c: CubeCoord, size: number): PixelCoord[] {
  const center = cubeToPixel(c, size);
  const corners: PixelCoord[] = [];
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI / 180) * (60 * k - 30);
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return corners;
}

/**
 * Exact (floating-point-free) identity for the 6 corner points of a hex.
 *
 * A pointy-top hex corner k sits at center + size*(cos(60k-30), sin(60k-30)).
 * Those trig values are always one of {0, ±1/2, ±√3/2}, so the corner
 * position is EXACTLY:
 *   x = size * Xb * √3 / 2
 *   y = size * Ya / 2
 * where Xb = 2q + r + bx[k] and Ya = 3r + by[k] are INTEGERS:
 *   bx = [ 1,  1, 0, -1, -1, 0]
 *   by = [-1,  1, 2,  1, -1, -2]
 *
 * Two corners are the same physical point IFF their (Xb, Ya) pairs are equal.
 * @returns the 6 corners as exact [Xb, Ya] integer pairs, k = 0..5.
 */
export function hexCornersExact(c: CubeCoord): [number, number][] {
  const bx = [1, 1, 0, -1, -1, 0];
  const by = [-1, 1, 2, 1, -1, -2];
  const out: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    out.push([2 * c.q + c.r + bx[k], 3 * c.r + by[k]]);
  }
  return out;
}

/** Stable string key for an exact corner (Xb, Ya). */
export function exactCornerKey(Xb: number, Ya: number): string {
  return `${Xb},${Ya}`;
}

/** Pixel position of an exact corner. */
export function exactCornerToPixel(Xb: number, Ya: number, size: number): PixelCoord {
  return { x: (size * Xb * Math.sqrt(3)) / 2, y: (size * Ya) / 2 };
}

/** The 6 neighbouring cube coordinates (clockwise from east). */
export function getNeighbors(c: CubeCoord): CubeCoord[] {
  const directions = [
    { q: 1, r: 0, s: -1 },
    { q: 1, r: -1, s: 0 },
    { q: 0, r: -1, s: 1 },
    { q: -1, r: 0, s: 1 },
    { q: -1, r: 1, s: 0 },
    { q: 0, r: 1, s: -1 },
  ];
  return directions.map((d) => ({ q: c.q + d.q, r: c.r + d.r, s: c.s + d.s }));
}

/** Validate the cube coordinate invariant q + r + s = 0. */
export function isValidCubeCoord(c: CubeCoord): boolean {
  return c.q + c.r + c.s === 0;
}

/** All cube coordinates of a hexagonal board of the given radius. */
export function hexCoordsForRadius(radius: number): CubeCoord[] {
  const coords: CubeCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      coords.push({ q, r, s: -q - r });
    }
  }
  return coords;
}
