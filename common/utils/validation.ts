import { Board, VertexId, EdgeId } from '../types/Board';
import { TurnState } from '../types/Logic';
import { playerSettlementVertexIds } from './placement';

/** Result of a build-eligibility check. */
export interface BuildCheck {
  allowed: boolean;
  reason: string | null;
}

/**
 * Authoritative settlement build check, shared by the UI and the backend:
 * turn, phase, once-per-turn placement, occupancy, and the distance rule.
 */
export function canBuildSettlementAt(
  board: Board,
  turn: TurnState,
  playerName: string,
  vertexId: VertexId
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  if (turn.phase !== 'SetUp' && turn.phase !== 'Build')
    return { allowed: false, reason: 'Only available in SetUp/Build phase' };
  if (turn.placedSettlement === true)
    return { allowed: false, reason: 'Settlement already placed this turn' };
  const vertex = board.vertices[vertexId];
  if (!vertex) return { allowed: false, reason: 'Vertex not found' };
  if (vertex.settlementId !== null) return { allowed: false, reason: 'Vertex already occupied' };
  const hasAdjacentSettlement = vertex.roadIds.some((edgeId) => {
    const edge = board.edges[edgeId];
    if (!edge) return false;
    const other = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
    return board.vertices[other]?.settlementId !== null;
  });
  if (hasAdjacentSettlement) return { allowed: false, reason: 'Too close to an existing settlement' };
  return { allowed: true, reason: null };
}

/**
 * Authoritative road build check, shared by the UI and the backend:
 * turn, phase, once-per-turn placement, existing road, and the ownership rule.
 */
export function canBuildRoadOn(
  board: Board,
  turn: TurnState,
  playerName: string,
  edgeId: EdgeId
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  if (turn.phase !== 'SetUp' && turn.phase !== 'Build')
    return { allowed: false, reason: 'Only available in SetUp/Build phase' };
  if (turn.placedRoad === true) return { allowed: false, reason: 'Road already placed this turn' };
  const edge = board.edges[edgeId];
  if (!edge) return { allowed: false, reason: 'Edge not found' };
  if (edge.roadId !== null) return { allowed: false, reason: 'A road already exists on this edge' };
  const owned = playerSettlementVertexIds(board, playerName);
  if (!owned.includes(edge.vertexAId) && !owned.includes(edge.vertexBId))
    return { allowed: false, reason: 'Edge must touch one of your settlements' };
  return { allowed: true, reason: null };
}
