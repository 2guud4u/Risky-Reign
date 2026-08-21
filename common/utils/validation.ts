import { Board, VertexId, EdgeId } from '../types/Board';
import { TurnState, ResourceCount } from '../types/Logic';
import { playerSettlementVertexIds, playerRoadEdgeIds } from './placement';
import { SettlementPrice, RoadPrice, canAfford } from './logic';

/** Result of a build-eligibility check. */
export interface BuildCheck {
  allowed: boolean;
  reason: string | null;
}

/**
 * Check if a vertex is adjacent to any of the player's roads.
 */
function isAdjacentToPlayerRoad(board: Board, playerName: string, vertexId: VertexId): boolean {
  const myRoads = playerRoadEdgeIds(board, playerName);
  return vertexId ? board.vertices[vertexId]?.roadIds.some((edgeId) => myRoads.includes(edgeId)) ?? false : false;
}

/**
 * Authoritative settlement build check, shared by the UI and the backend:
 * turn, phase, once-per-turn placement, occupancy, distance rule, and resources.
 */
export function canBuildSettlementAt(
  board: Board,
  turn: TurnState,
  playerName: string,
  vertexId: VertexId,
  playerResources?: ResourceCount
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  if (turn.phase !== 'SetUp' && turn.phase !== 'Build')
    return { allowed: false, reason: 'Only available in SetUp/Build phase' };
  // In SetUp, only one settlement per turn. In Build, unlimited (limited by resources).
  if (turn.phase === 'SetUp' && turn.placedSettlement === true)
    return { allowed: false, reason: 'Settlement already placed this turn' };
  
  const vertex = board.vertices[vertexId];
  if (!vertex) return { allowed: false, reason: 'Vertex not found' };
  if (vertex.settlementId !== null) return { allowed: false, reason: 'Vertex already occupied' };
  
  // Distance rule: no adjacent settlements
  const hasAdjacentSettlement = vertex.roadIds.some((edgeId) => {
    const edge = board.edges[edgeId];
    if (!edge) return false;
    const other = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
    return board.vertices[other]?.settlementId !== null;
  });
  if (hasAdjacentSettlement) return { allowed: false, reason: 'Too close to an existing settlement' };
  
  // In Build phase (after setup), must be adjacent to your road
  if (turn.phase === 'Build') {
    if (!isAdjacentToPlayerRoad(board, playerName, vertexId)) {
      return { allowed: false, reason: 'Must build next to one of your roads' };
    }
    
    // Check resources in Build phase
    if (playerResources && !canAfford(playerResources, SettlementPrice)) {
      return { allowed: false, reason: 'Not enough resources for a settlement' };
    }
  }
  
  return { allowed: true, reason: null };
}

/**
 * Authoritative road build check, shared by the UI and the backend:
 * turn, phase, once-per-turn placement, existing road, ownership rule, and resources.
 */
export function canBuildRoadOn(
  board: Board,
  turn: TurnState,
  playerName: string,
  edgeId: EdgeId,
  playerResources?: ResourceCount
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  if (turn.phase !== 'SetUp' && turn.phase !== 'Build')
    return { allowed: false, reason: 'Only available in SetUp/Build phase' };
  // In SetUp, only one road per turn. In Build, unlimited (limited by resources).
  if (turn.phase === 'SetUp' && turn.placedRoad === true)
    return { allowed: false, reason: 'Road already placed this turn' };
  
  const edge = board.edges[edgeId];
  if (!edge) return { allowed: false, reason: 'Edge not found' };
  if (edge.roadId !== null) return { allowed: false, reason: 'A road already exists on this edge' };
  
  // Must touch one of your settlements OR extend from one of your roads.
  const owned = playerSettlementVertexIds(board, playerName);
  if (owned.includes(edge.vertexAId) || owned.includes(edge.vertexBId)) {
    return { allowed: true, reason: null };
  }
  const myRoads = playerRoadEdgeIds(board, playerName);
  const touchesMyRoad = myRoads.some((roadEdgeId) => {
    const roadEdge = board.edges[roadEdgeId];
    if (!roadEdge) return false;
    return (
      roadEdge.vertexAId === edge.vertexAId ||
      roadEdge.vertexAId === edge.vertexBId ||
      roadEdge.vertexBId === edge.vertexAId ||
      roadEdge.vertexBId === edge.vertexBId
    );
  });
  if (!touchesMyRoad) {
    return { allowed: false, reason: 'Must build from your settlement or extend an existing road' };
  }
  
  // Check resources in Build phase
  if (turn.phase === 'Build') {
    if (playerResources && !canAfford(playerResources, RoadPrice)) {
      return { allowed: false, reason: 'Not enough resources for a road' };
    }
  }
  
  return { allowed: true, reason: null };
}
