import { Board } from 'common';

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

/**
 * Deterministic nicknames ('a', 'b', …) for a vertex's neighbor vertices,
 * assigned in `roadIds` order, so a vertex's neighbors always get the same
 * letters (used for the mini map's neighbor labels).
 */
export function neighborNicknames(board: Board, vertexId: string): Record<string, string> {
  const vertex = board.vertices[vertexId];
  if (!vertex) return {};
  const out: Record<string, string> = {};
  let i = 0;
  for (const edgeId of vertex.roadIds) {
    if (i >= LETTERS.length) break;
    const edge = board.edges[edgeId];
    if (!edge) continue;
    const otherId = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
    if (!otherId || otherId in out) continue;
    out[otherId] = LETTERS[i];
    i += 1;
  }
  return out;
}
