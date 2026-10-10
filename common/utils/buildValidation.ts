import { Board, VertexId, EdgeId } from '../types/Board';
import { TurnState, ResourceCount, BuildCheck } from '../types/Logic';
import { playerSettlementVertexIds, playerRoadEdgeIds } from './placement';
import { canAfford } from './logic';
import { SettlementPrice, RoadPrice, CityPrice, MAX_SETTLEMENTS, MAX_CITIES, MAX_ROADS } from '../Constant';

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
  // Official piece-pool limit: a city is an upgraded settlement, so both
  // share the 5-settlement pool.
  if (playerSettlementVertexIds(board, playerName).length >= MAX_SETTLEMENTS)
    return { allowed: false, reason: `You already have the maximum ${MAX_SETTLEMENTS} settlements (including cities)` };
  
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
 * Authoritative check for placing a city directly during setup (the room's
 * "setup cities" setting): every settlement placement rule applies, plus the
 * player must still have a setup city left (`setupCities` minus the cities
 * they already own — during setup every city is a setup city).
 */
export function canPlaceSetupCityAt(
  board: Board,
  turn: TurnState,
  playerName: string,
  vertexId: VertexId,
  setupCities: number
): BuildCheck {
  if (turn.phase !== 'SetUp') return { allowed: false, reason: 'Cities can only be placed directly during setup' };
  const placement = canBuildSettlementAt(board, turn, playerName, vertexId);
  if (!placement.allowed) return placement;
  const cities = Object.values(board.settlements).filter(
    (s) => s.ownerId === playerName && s.level === 'city'
  ).length;
  if (cities >= setupCities)
    return {
      allowed: false,
      reason:
        setupCities === 0
          ? 'This game does not allow cities during setup'
          : `You already placed your ${setupCities} setup ${setupCities === 1 ? 'city' : 'cities'}`,
    };
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
  // Official piece-pool limit (15 roads).
  if (playerRoadEdgeIds(board, playerName).length >= MAX_ROADS)
    return { allowed: false, reason: `You already have the maximum ${MAX_ROADS} roads` };
  
  // Must touch one of your settlements OR extend from one of your roads.
  const owned = playerSettlementVertexIds(board, playerName);
  const touchesSettlement = owned.includes(edge.vertexAId) || owned.includes(edge.vertexBId);
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
  if (!touchesSettlement && !touchesMyRoad) {
    return { allowed: false, reason: 'Must build from your settlement or extend an existing road' };
  }

  // Check resources in Build phase (applies whether the road touches a
  // settlement or extends a road — the settlement branch must not skip it).
  if (turn.phase === 'Build') {
    if (playerResources && !canAfford(playerResources, RoadPrice)) {
      return { allowed: false, reason: 'Not enough resources for a road' };
    }
  }

  return { allowed: true, reason: null };
}

/**
 * Authoritative city-upgrade check, shared by the UI and the backend:
 * only during Build phase, on your turn, on one of your own settlements
 * that is not yet a city, and you must afford the upgrade cost.
 */
export function canUpgradeSettlementToCity(
  board: Board,
  turn: TurnState,
  playerName: string,
  vertexId: VertexId,
  playerResources?: ResourceCount
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  if (turn.phase !== 'Build')
    return { allowed: false, reason: 'Cities can only be built in the Build phase' };
  const vertex = board.vertices[vertexId];
  if (!vertex || !vertex.settlementId)
    return { allowed: false, reason: 'No settlement on this vertex to upgrade' };
  const settlement = board.settlements[vertex.settlementId];
  if (!settlement) return { allowed: false, reason: 'Settlement not found' };
  if (settlement.ownerId !== playerName)
    return { allowed: false, reason: 'You can only upgrade your own settlements' };
  if (settlement.level === 'city')
    return { allowed: false, reason: 'Already a city' };
  // Official piece-pool limit (4 cities).
  const cityCount = Object.values(board.settlements).filter(
    (s) => s.ownerId === playerName && s.level === 'city'
  ).length;
  if (cityCount >= MAX_CITIES)
    return { allowed: false, reason: `You already have the maximum ${MAX_CITIES} cities` };
  if (playerResources && !canAfford(playerResources, CityPrice))
    return { allowed: false, reason: 'Not enough resources to upgrade to a city' };
  return { allowed: true, reason: null };
}
