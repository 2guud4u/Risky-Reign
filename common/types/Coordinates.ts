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
 * The canonical vertex ID is a deterministic function of the exact corner
 * position (Xb, Ya) — see `exactVertexId` in `utils/coordinates.ts`.
 *
 * ── EDGE CANONICALIZATION ──────────────────────────────────────────────────
 * An edge is a segment between two adjacent vertices, with 1 or 2 hexes on its
 * sides (1 = board boundary). The canonical edge ID is derived from its two
 * endpoint VERTEX ids (sorted and joined) — see `canonicalEdgeId` in
 * `utils/coordinates.ts`.
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
