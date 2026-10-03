import { Board, VertexId, VertexNode } from 'common';

/** Road adjacency for a vertex: drives soldier group moves (`useVertexGroup`). */

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
