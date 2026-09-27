import { Board, VertexId, VertexNode } from 'common';
import { AdjacentEdgeInfo } from '../types/vertex';

/**
 * Road/edge adjacency helpers for a vertex. Shared by the sidebar vertex
 * panel: `roadAdjacentVertexIds` drives the group-move buttons and
 * `adjacentEdges` drives the "Adjacent Edges" list.
 */

/** Vertex ids reachable from `vertex` via existing roads (deduped defensively). */
export function roadAdjacentVertexIds(board: Board, vertex: VertexNode): VertexId[] {
  return Array.from(
    new Set(
      vertex.roadIds
        .map((edgeId) => {
          const edge = board.edges[edgeId];
          if (!edge || edge.roadId === null) return null;
          const otherId = edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId;
          return otherId ?? null;
        })
        .filter((id): id is VertexId => id !== null && id !== undefined)
    )
  );
}

/** Every edge around the vertex paired with the vertex id on its far side. */
export function adjacentEdges(board: Board, vertex: VertexNode): AdjacentEdgeInfo[] {
  return Array.from(new Set(vertex.roadIds)).map((edgeId) => {
    const edge = board.edges[edgeId] ?? null;
    const otherId = edge ? (edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId) : null;
    return { edge, otherId };
  });
}
