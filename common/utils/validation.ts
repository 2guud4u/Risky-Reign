import { Board, VertexId, EdgeId } from '../types/Board';
import { TurnState, ResourceCount, Price } from '../types/Logic';
import { playerSettlementVertexIds, playerRoadEdgeIds } from './placement';
import { SettlementPrice, RoadPrice, CityPrice, SoldierPrice, canAfford } from './logic';

/**
 * Healing cost: twice the soldier creation cost (Rules.md line 27: "paying 2 of
 * each card used to create the soldier. No duplicates.").
 */
export const HealSoldierPrice: Price = { Wood: 0, Brick: 0, Sheep: 2, Wheat: 2, Ore: 0 };

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
  if (playerResources && !canAfford(playerResources, CityPrice))
    return { allowed: false, reason: 'Not enough resources to upgrade to a city' };
  return { allowed: true, reason: null };
}

/**
 * Authoritative soldier build check, shared by the UI and the backend:
 * only during Build phase, on your turn, on one of your own settlements,
 * and you must afford the soldier cost.
 */
export function canBuildSoldierAt(
  board: Board,
  turn: TurnState,
  playerName: string,
  vertexId: VertexId,
  playerResources?: ResourceCount
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  // Soldiers are built during the Action phase (Rules.md "Soldier" section).
  if (turn.phase !== 'Action')
    return { allowed: false, reason: 'Soldiers can only be built in the Action phase' };

  const vertex = board.vertices[vertexId];
  if (!vertex || !vertex.settlementId)
    return { allowed: false, reason: 'No settlement on this vertex to garrison a soldier' };

  const settlement = board.settlements[vertex.settlementId];
  if (!settlement) return { allowed: false, reason: 'Settlement not found' };
  if (settlement.ownerId !== playerName)
    return { allowed: false, reason: 'You can only build soldiers on your own settlements' };

  if (playerResources && !canAfford(playerResources, SoldierPrice))
    return { allowed: false, reason: 'Not enough resources for a soldier (1 Wheat, 1 Sheep)' };

  return { allowed: true, reason: null };
}

/**
 * Authoritative soldier movement check, shared by the UI and the backend:
 * only during Action phase, on your turn, moving one of your own soldiers
 * to an adjacent vertex connected by ANY existing road (regardless of owner).
 */
export function canMoveSoldierTo(
  board: Board,
  turn: TurnState,
  playerName: string,
  soldierId: string,
  targetVertexId: VertexId
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  if (turn.phase !== 'Action')
    return { allowed: false, reason: 'Soldiers can only move in the Action phase' };

  // Each soldier gets one action per Action phase (Rules.md line 30).
  if (turn.soldiersActedThisTurn.includes(soldierId))
    return { allowed: false, reason: 'This soldier already used its action this phase' };

  const soldier = board.soldiers[soldierId];
  if (!soldier) return { allowed: false, reason: 'Soldier not found' };
  if (soldier.owner !== playerName)
    return { allowed: false, reason: 'You can only move your own soldiers' };

  // Rule 24: cannot create and move a soldier on the same turn.
  if (turn.soldiersCreatedThisTurn.includes(soldierId))
    return { allowed: false, reason: 'A freshly built soldier cannot move this turn' };

  // Rule 25: healed soldiers cannot move on the same turn they were healed.
  if (turn.soldiersHealedThisTurn.includes(soldierId))
    return { allowed: false, reason: 'A freshly healed soldier cannot move this turn' };

  const targetVertex = board.vertices[targetVertexId];
  if (!targetVertex) return { allowed: false, reason: 'Target vertex not found' };

  // Check that the soldier is adjacent to the target via an existing road.
  const isAdjacentViaRoad = targetVertex.roadIds.some((edgeId) => {
    const edge = board.edges[edgeId];
    if (!edge || edge.roadId === null) return false; // no road on this edge
    const other = edge.vertexAId === soldier.vertexId ? edge.vertexBId : edge.vertexAId;
    return other === targetVertexId;
  });

  if (!isAdjacentViaRoad)
    return { allowed: false, reason: 'Must move along an existing road to an adjacent vertex' };

  return { allowed: true, reason: null };
}

/**
 * Authoritative soldier heal check (Rules.md line 27): only during Action phase,
 * on your turn, for one of your own injured soldiers standing on a settlement you
 * own, and you must afford the heal cost (2 of each creation resource).
 */
export function canHealSoldierAt(
  board: Board,
  turn: TurnState,
  playerName: string,
  soldierId: string,
  playerResources?: ResourceCount
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  if (turn.phase !== 'Action')
    return { allowed: false, reason: 'Soldiers can only be healed in the Action phase' };

  // Each soldier gets one action per Action phase (Rules.md line 30).
  if (turn.soldiersActedThisTurn.includes(soldierId))
    return { allowed: false, reason: 'This soldier already used its action this phase' };

  const soldier = board.soldiers[soldierId];
  if (!soldier) return { allowed: false, reason: 'Soldier not found' };
  if (soldier.owner !== playerName)
    return { allowed: false, reason: 'You can only heal your own soldiers' };
  if (!soldier.injured)
    return { allowed: false, reason: 'This soldier is not injured' };

  // Injured soldiers can only be healed while standing on a settlement you own
  // (Rules.md "Soldier" section). They must be moved to your settlement first.
  const soldierVertex = board.vertices[soldier.vertexId];
  if (!soldierVertex || !soldierVertex.settlementId)
    return { allowed: false, reason: 'This soldier is not on one of your settlements' };
  const settlement = board.settlements[soldierVertex.settlementId];
  if (!settlement)
    return { allowed: false, reason: 'This soldier is not on one of your settlements' };
  if (settlement.ownerId !== playerName)
    return { allowed: false, reason: 'You can only heal soldiers on your own settlements' };

  if (playerResources && !canAfford(playerResources, HealSoldierPrice))
    return { allowed: false, reason: 'Not enough resources to heal a soldier (2 Wheat, 2 Sheep)' };

  return { allowed: true, reason: null };
}
