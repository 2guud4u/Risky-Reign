/**
 * Coordinate System Specification
 * 
 * Hex coordinates use cube coordinates (q, r, s) where q + r + s = 0
 * This is the canonical coordinate system for all hex maps.
 * 
 * Canonicalization Rules:
 * 
 * VERTEX CANONICALIZATION:
 * A vertex is uniquely identified by the set of hexes that meet at that point.
 * For a vertex with adjacent hexes H1, H2, H3 (2-3 hexes):
 *   - Collect all hex coordinate tuples (q, r, s)
 *   - Sort lexicographically: by q, then r, then s
 *   - Join with ':' separator
 *   - Example: "(-1,0,1):(0,0,0):(1,-1,0)" → vertex_id = "v_-1,0,1_0,0,0_1,-1,0"
 * 
 * EDGE CANONICALIZATION:
 * An edge is uniquely identified by the set of hexes on either side (1-2 hexes):
 *   - Collect all hex coordinate tuples
 *   - Sort lexicographically
 *   - Join with ':' separator
 *   - Example: "(0,0,0):(1,-1,0)" → edge_id = "e_0,0,0_1,-1,0"
 * 
 * IMPORTANT: Never derive ID from a single hex. A vertex/edge belongs to multiple
 * hexes, and deriving from just one would create duplicate IDs for the same physical
 * entity.
 * 
 * Property Tests:
 * 1. Every vertex has 2-3 hex neighbors
 * 2. Every edge has 1-2 hex neighbors
 * 3. Same physical vertex always produces same ID regardless of which adjacent hex
 *    you start from
 * 4. No two distinct physical vertices share an ID
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

/**
 * Generate canonical vertex ID from adjacent hex coordinates
 * @param hexCoords - Array of 2-3 cube coordinates adjacent to the vertex
 * @returns Canonical vertex ID string
 */
export function canonicalVertexId(hexCoords: CubeCoord[]): string {
  if (hexCoords.length < 2 || hexCoords.length > 3) {
    throw new Error(`Vertex must have 2-3 adjacent hexes, got ${hexCoords.length}`);
  }
  
  const sorted = [...hexCoords].sort((a, b) => {
    if (a.q !== b.q) return a.q - b.q;
    if (a.r !== b.r) return a.r - b.r;
    return a.s - b.s;
  });
  
  const coordStr = sorted.map(c => `${c.q},${c.r},${c.s}`).join('_');
  return `v_${coordStr}`;
}

/**
 * Generate canonical edge ID from adjacent hex coordinates
 * @param hexCoords - Array of 1-2 cube coordinates adjacent to the edge
 * @returns Canonical edge ID string
 */
export function canonicalEdgeId(hexCoords: CubeCoord[]): string {
  if (hexCoords.length < 1 || hexCoords.length > 2) {
    throw new Error(`Edge must have 1-2 adjacent hexes, got ${hexCoords.length}`);
  }
  
  const sorted = [...hexCoords].sort((a, b) => {
    if (a.q !== b.q) return a.q - b.q;
    if (a.r !== b.r) return a.r - b.r;
    return a.s - b.s;
  });
  
  const coordStr = sorted.map(c => `${c.q},${c.r},${c.s}`).join('_');
  return `e_${coordStr}`;
}

/**
 * Convert cube coordinates to pixel coordinates
 */
export function cubeToPixel(q: number, r: number, s: number, size: number): PixelCoord {
  const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = size * (3 / 2 * r);
  return { x, y };
}

/**
 * Get the 6 neighboring hex coordinates
 */
export function getNeighbors(coord: CubeCoord): CubeCoord[] {
  const directions = [
    { q: 1, r: 0, s: -1 },
    { q: 1, r: -1, s: 0 },
    { q: 0, r: -1, s: 1 },
    { q: -1, r: 0, s: 1 },
    { q: -1, r: 1, s: 0 },
    { q: 0, r: 1, s: -1 },
  ];
  
  return directions.map(d => ({
    q: coord.q + d.q,
    r: coord.r + d.r,
    s: coord.s + d.s,
  }));
}

/**
 * Get the 6 vertices around a hex in clockwise order
 * Returns vertex IDs, not coordinates
 */
export function getHexVertices(hexCoord: CubeCoord): CubeCoord[][] {
  const neighbors = getNeighbors(hexCoord);
  
  // Each vertex is shared by 2-3 hexes
  // For each edge between hex and neighbor, we can find the vertex
  const vertices: CubeCoord[][] = [];
  
  // This is a simplified version - actual implementation would need
  // to find the common vertices between hex and its neighbors
  // For now, return placeholder
  return vertices;
}

/**
 * Validate cube coordinates
 */
export function isValidCubeCoord(coord: CubeCoord): boolean {
  return coord.q + coord.r + coord.s === 0;
}
