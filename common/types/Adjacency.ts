import { PixelCoord } from './Coordinates';

/**
 * Node shapes for the adjacency graph produced by `computeAdjacency`.
 * Types only — the computation lives in `utils/adjacency.ts`.
 */

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
