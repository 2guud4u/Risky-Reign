/**
 * Pure adjacency computation for a board graph.
 * Shape-agnostic: works with any set of hex coordinates, not just the
 * standard 19-hex board.
 *
 * Canonicalization (see types/Coordinates.ts):
 *  - A vertex is the set of 1-3 hexes meeting at one corner point.
 *  - An edge is the segment between two adjacent vertices (1-2 hexes on its
 *    sides).
 *
 * Corner points are matched by rounded pixel position so that floating point
 * error from independent cube->pixel conversions never splits one physical
 * vertex into two.
 */

import {
  CubeCoord,
  PixelCoord,
  canonicalEdgeId,
  canonicalVertexId,
  hexCorners,
  hexId,
} from '../types/Coordinates';

export interface VertexInfo {
  id: string;
  position: PixelCoord;
  /** 1-3 distinct hexes meeting at this vertex. */
  hexIds: string[];
}

export interface EdgeInfo {
  id: string;
  vertexAId: string;
  vertexBId: string;
  /** 1-2 distinct hexes on either side. */
  hexIds: string[];
}

export interface AdjacencyGraph {
  vertices: Map<string, VertexInfo>;
  edges: Map<string, EdgeInfo>;
  /** vertex id -> set of adjacent vertex ids */
  vertexNeighbors: Map<string, Set<string>>;
  /** vertex id -> set of incident edge ids */
  vertexEdges: Map<string, Set<string>>;
}

/** Round to a stable key so FP noise never splits a physical point. */
function pointKey(p: PixelCoord): string {
  return `${Math.round(p.x * 1e4) / 1e4},${Math.round(p.y * 1e4) / 1e4}`;
}

/**
 * Compute the full vertex/edge graph for an arbitrary hex layout.
 * @param coords - cube coordinates of every hex on the board
 * @param size   - hex size used for pixel projection (ids are size-independent)
 */
export function computeAdjacency(coords: CubeCoord[], size: number = 50): AdjacencyGraph {
  // Pass 1: collect every corner point and the hexes meeting there.
  const pointToHexes = new Map<string, { position: PixelCoord; hexIds: string[] }>();
  const pointToCoord = new Map<string, CubeCoord[]>();

  for (const c of coords) {
    const hid = hexId(c);
    const corners = hexCorners(c, size);
    corners.forEach((p) => {
      const k = pointKey(p);
      if (!pointToHexes.has(k)) {
        pointToHexes.set(k, { position: p, hexIds: [] });
        pointToCoord.set(k, []);
      }
      const entry = pointToHexes.get(k)!;
      if (!entry.hexIds.includes(hid)) entry.hexIds.push(hid);
      pointToCoord.get(k)!.push(c);
    });
  }

  // Build canonical vertices.
  const vertices = new Map<string, VertexInfo>();
  const vertexByPoint = new Map<string, string>(); // pointKey -> vertexId
  for (const [k, entry] of pointToHexes) {
    const id = canonicalVertexId(pointToCoord.get(k)!);
    vertices.set(id, { id, position: entry.position, hexIds: entry.hexIds });
    vertexByPoint.set(k, id);
  }

  // Pass 2: edges = consecutive corner pairs of each hex, deduped by vertex pair.
  const edges = new Map<string, EdgeInfo>();
  const edgeHexes = new Map<string, string[]>();
  for (const c of coords) {
    const hid = hexId(c);
    const corners = hexCorners(c, size);
    for (let i = 0; i < 6; i++) {
      const a = vertexByPoint.get(pointKey(corners[i]))!;
      const b = vertexByPoint.get(pointKey(corners[(i + 1) % 6]))!;
      const id = canonicalEdgeId(a, b);
      if (!edges.has(id)) {
        edges.set(id, { id, vertexAId: a, vertexBId: b, hexIds: [] });
        edgeHexes.set(id, []);
      }
      const list = edgeHexes.get(id)!;
      if (!list.includes(hid)) list.push(hid);
    }
  }
  for (const [id, info] of edges) {
    info.hexIds = edgeHexes.get(id)!;
  }

  // Pass 3: adjacency maps.
  const vertexNeighbors = new Map<string, Set<string>>();
  const vertexEdges = new Map<string, Set<string>>();
  for (const v of vertices.keys()) {
    vertexNeighbors.set(v, new Set());
    vertexEdges.set(v, new Set());
  }
  for (const e of edges.values()) {
    vertexNeighbors.get(e.vertexAId)!.add(e.vertexBId);
    vertexNeighbors.get(e.vertexBId)!.add(e.vertexAId);
    vertexEdges.get(e.vertexAId)!.add(e.id);
    vertexEdges.get(e.vertexBId)!.add(e.id);
  }

  return { vertices, edges, vertexNeighbors, vertexEdges };
}

/**
 * Property-test assertions for the canonicalization spec.
 * Returns a list of human-readable failures (empty = all pass).
 */
export function validateAdjacency(coords: CubeCoord[], size: number = 50): string[] {
  const g = computeAdjacency(coords, size);
  const failures: string[] = [];

  for (const v of g.vertices.values()) {
    const n = v.hexIds.length;
    if (n < 1 || n > 3) failures.push(`vertex ${v.id} has ${n} hex neighbours (expected 1-3)`);
    if (new Set(v.hexIds).size !== v.hexIds.length) {
      failures.push(`vertex ${v.id} lists duplicate hexes`);
    }
  }
  for (const e of g.edges.values()) {
    const n = e.hexIds.length;
    if (n < 1 || n > 2) failures.push(`edge ${e.id} has ${n} hex neighbours (expected 1-2)`);
    if (e.vertexAId === e.vertexBId) failures.push(`edge ${e.id} is a self-loop`);
    if (!g.vertices.has(e.vertexAId) || !g.vertices.has(e.vertexBId)) {
      failures.push(`edge ${e.id} references unknown vertex`);
    }
  }

  // Every vertex must be incident to 2-3 edges.
  for (const [id, es] of g.vertexEdges) {
    if (es.size < 2 || es.size > 3) {
      failures.push(`vertex ${id} incident to ${es.size} edges (expected 2-3)`);
    }
  }

  // Determinism: recompute from a reversed hex order, ids must be identical.
  const reversed = [...coords].reverse();
  const g2 = computeAdjacency(reversed, size);
  if (g2.vertices.size !== g.vertices.size || g2.edges.size !== g.edges.size) {
    failures.push(`recompute from reversed order changed sizes (${g2.vertices.size}/${g2.edges.size})`);
  } else {
    for (const [id, v] of g.vertices) {
      const v2 = g2.vertices.get(id);
      if (!v2) {
        failures.push(`vertex ${id} missing on recompute`);
        continue;
      }
      if (
        Math.abs(v2.position.x - v.position.x) > 1e-9 ||
        Math.abs(v2.position.y - v.position.y) > 1e-9
      ) {
        failures.push(`vertex ${id} position differs on recompute`);
      }
      if (v2.hexIds.slice().sort().join() !== v.hexIds.slice().sort().join()) {
        failures.push(`vertex ${id} hex set differs on recompute`);
      }
    }
    for (const [id, e] of g.edges) {
      const e2 = g2.edges.get(id);
      if (!e2) {
        failures.push(`edge ${id} missing on recompute`);
        continue;
      }
      if (
        e2.vertexAId !== e.vertexAId ||
        e2.vertexBId !== e.vertexBId ||
        e2.hexIds.slice().sort().join() !== e.hexIds.slice().sort().join()
      ) {
        failures.push(`edge ${id} differs on recompute`);
      }
    }
  }

  return failures;
}
