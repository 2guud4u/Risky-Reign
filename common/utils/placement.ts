
/**
 * Placement validation rules (pure functions over the domain Board).
 * These are the rules the UI uses to highlight valid build targets and the
 * rules the backend enforces authoritatively.
 */

import { Board, VertexId } from '../types/Board';

/**
 * Vertices where a settlement may be built:
 *  - no settlement already there
 *  - no settlement on any adjacent vertex (distance rule)
 */
export function validSettlementVertices(board: Board): VertexId[] {
  const result: VertexId[] = [];
  for (const v of Object.values(board.vertices)) {
    if (v.settlementId !== null) continue;
    const hasAdjacentSettlement = v.roadIds.some((edgeId) => {
      const edge = board.edges[edgeId];
      if (!edge) return false;
      const other = edge.vertexAId === v.id ? edge.vertexBId : edge.vertexAId;
      return board.vertices[other]?.settlementId !== null;
    });
    if (!hasAdjacentSettlement) result.push(v.id);
  }
  return result;
}

/**
 * Edges where a road may be built:
 *  - no road already there
 *  - at least one endpoint is one of the player's settlement vertices
 */
export function validRoadEdges(board: Board, ownedSettlementVertexIds: VertexId[]): string[] {
  const result: string[] = [];
  for (const e of Object.values(board.edges)) {
    if (e.roadId !== null) continue;
    const touchesOwned =
      ownedSettlementVertexIds.includes(e.vertexAId) ||
      ownedSettlementVertexIds.includes(e.vertexBId);
    if (touchesOwned) result.push(e.id);
  }
  return result;
}

/** The vertex ids on which the given player has a settlement. */
export function playerSettlementVertexIds(board: Board, playerId: string): VertexId[] {
  return Object.values(board.settlements)
    .filter((s) => s.ownerId === playerId)
    .map((s) => s.vertexId);
}
