/**
 * Coordinate System Specification (canonical)
 *
 * Hexes use CUBE coordinates (q, r, s) with the invariant q + r + s = 0.
 * This is the single canonical coordinate system for every hex map, standard
 * or custom.
 *
 * ── VERTEX CANONICALIZATION ────────────────────────────────────────────────
 * A vertex is a geometric point where 1, 2, or 3 hexes meet:
 *   - 3 hexes: an interior vertex
 *   - 2 hexes: a vertex on the border of the hex region
 *   - 1 hex:   a boundary (outer) vertex
 *
 * The canonical vertex ID is a deterministic function of the SET of adjacent
 * hex coordinates: sort the tuples lexicographically (by q, then r, then s)
 * and join them with '_'.
 *
 *   e.g. hexes (0,0,0) and (1,-1,0)  ->  vertex id "v_0,0,0_1,-1,0"
 *
 * NOTE: this corrects the original plan spec, which said a vertex has 2-3 hex
 * neighbours and derived the id from the hexes of a single hex-edge. On a
 * finite board that is wrong in two ways: (1) boundary vertices touch only 1
 * hex, and (2) keying off a hex-edge midpoint mints the SAME id for two
 * distinct physical vertices that share that edge. Keying off the corner point
 * (the set of hexes meeting there) is what makes the id unique and stable no
 * matter which adjacent hex you start from.
 *
 * ── EDGE CANONICALIZATION ──────────────────────────────────────────────────
 * An edge is a segment between two adjacent vertices, with 1 or 2 hexes on its
 * sides (1 = board boundary). The canonical edge ID is derived from its two
 * endpoint VERTEX ids (sorted and joined), NOT from hex coordinates:
 *
 *   e.g. vertices "v_..." and "v_..."  ->  edge id "e_<va>_<vb>"
 *
 * NOTE: this also corrects the plan spec. Deriving an edge id from its (1-2)
 * adjacent hex coordinates collides for boundary edges, because a boundary
 * edge has only ONE adjacent hex and several distinct boundary edges can share
 * that single hex. The vertex-pair is the unambiguous source of truth (the
 * plan explicitly permits choosing the vertex pair as the single source).
 *
 * ── PROPERTY TESTS (see validateAdjacency) ─────────────────────────────────
 * 1. Every vertex has 1-3 distinct hex neighbours.
 * 2. Every edge has 1-2 distinct hex neighbours (1 = board boundary).
 * 3. The same physical vertex/edge yields the identical id regardless of which
 *    adjacent hex you start the computation from.
 * 4. No two distinct physical vertices/edges share an id.
 */

export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

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
 *
 * NOTE: a vertex id derived from the *set of adjacent hexes* (the original
 * plan spec) is WRONG for boundary vertices — several outer corners of the
 * same boundary hex each have hex-set {that hex} and would collide to one id.
 * Position-based ids are the only scheme that satisfies "no two distinct
 * vertices share an id".
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
 * This is immune to the ~1e-13 floating-point noise that makes independent
 * cube->pixel conversions of adjacent hexes disagree and would otherwise
 * split one physical vertex into two.
 *
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
