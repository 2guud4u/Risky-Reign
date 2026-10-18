import { Board, VertexId } from '../types/Board';
import { playerRoadEdgeIds, playerSettlementVertexIds } from './placement';

/**
 * Vertex water/land classification. Shape-agnostic: a vertex's land count is
 * the number of adjacent hexes that exist and are not 'Water' — missing hexes
 * count as water (ringless custom maps are sea beyond their edge).
 *
 * - land vertex: >= 1 land hex (any vertex troops can stand on)
 * - coast vertex: exactly 1 land hex (also water — ships may occupy it)
 * - sea vertex: 0 land hexes (water only)
 * Ships live on water vertices (coast or sea); soldiers live on land
 * vertices and cross to ships via embark.
 */

/** Number of existing non-water hexes touching the vertex (0-3). */
export function landHexCount(board: Board, vertexId: VertexId): number {
  const v = board.vertices[vertexId];
  if (!v) return 0;
  return v.hexIds.filter((id) => board.hexes[id] && board.hexes[id].terrain !== 'Water').length;
}

/** True when the vertex touches at least one land hex (troops/buildings live here). */
export function isLandVertex(board: Board, vertexId: VertexId): boolean {
  return landHexCount(board, vertexId) >= 1;
}

/** True when the vertex touches exactly one land hex — the coastline. */
export function isCoastVertex(board: Board, vertexId: VertexId): boolean {
  return landHexCount(board, vertexId) === 1;
}

/** True when every adjacent hex is water or missing (open sea). */
export function isSeaVertex(board: Board, vertexId: VertexId): boolean {
  return landHexCount(board, vertexId) === 0;
}

/** True when a ship may occupy the vertex: coast or open sea. */
export function isWaterVertex(board: Board, vertexId: VertexId): boolean {
  return landHexCount(board, vertexId) <= 1;
}

/** Vertices adjacent to `vertexId` via any board edge (road or not). */
export function adjacentVertexIds(board: Board, vertexId: VertexId): VertexId[] {
  const vertex = board.vertices[vertexId];
  if (!vertex) return [];
  const out: VertexId[] = [];
  for (const edgeId of vertex.roadIds) {
    const edge = board.edges[edgeId];
    if (!edge) continue;
    out.push(edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId);
  }
  return out;
}

/** True when `b` is one edge away from `a`. */
export function verticesAdjacent(board: Board, a: VertexId, b: VertexId): boolean {
  return adjacentVertexIds(board, a).includes(b);
}

/**
 * May `playerName` anchor a ship build on this coast vertex? The vertex must
 * either hold one of their settlements/cities or be an endpoint of one of
 * their road edges (a road "touches" the coast there).
 */
export function coastVertexReachable(board: Board, vertexId: VertexId, playerName: string): boolean {
  const vertex = board.vertices[vertexId];
  if (!vertex) return false;
  const myRoads = new Set(playerRoadEdgeIds(board, playerName));
  if (vertex.roadIds.some((edgeId) => myRoads.has(edgeId))) return true;
  return playerSettlementVertexIds(board, playerName).includes(vertexId);
}
