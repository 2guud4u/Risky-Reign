import { Board, VertexId } from '../types/Board';
import { TurnState, ResourceCount, BuildCheck, ResourceKey } from '../types/Logic';
import { playerSettlementVertexIds } from './placement';
import { canAfford } from './logic';
import { SoldierPrice, HealSoldierResources } from '../Constant';

/**
 * Authoritative soldier recruitment check, shared by the UI and the backend:
 * only during the Action phase, on your turn, on one of your own settlements,
 * and you must afford the soldier cost.
 */
export function canRecruitSoldierAt(
  board: Board,
  turn: TurnState,
  playerName: string,
  vertexId: VertexId,
  playerResources?: ResourceCount
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  // Soldiers are recruited during the Action phase (Rules.md "Soldier" section).
  if (turn.phase !== 'Action')
    return { allowed: false, reason: 'Soldiers can only be recruited in the Action phase' };

  const vertex = board.vertices[vertexId];
  if (!vertex || !vertex.settlementId)
    return { allowed: false, reason: 'No settlement on this vertex to garrison a soldier' };

  const settlement = board.settlements[vertex.settlementId];
  if (!settlement) return { allowed: false, reason: 'Settlement not found' };
  if (settlement.ownerId !== playerName)
    return { allowed: false, reason: 'You can only recruit soldiers on your own settlements' };

  if (playerResources && !canAfford(playerResources, SoldierPrice))
    return { allowed: false, reason: 'Not enough resources for a soldier (1 Wheat, 1 Sheep)' };

  return { allowed: true, reason: null };
}

/**
 * Authoritative soldier heal check (Rules.md line 27): only during Action phase,
 * on your turn, for one of your own injured soldiers standing on a settlement you
 * own, and you must afford the heal cost — 1 card of either Wheat or Sheep.
 */
export function canHealSoldierAt(
  board: Board,
  turn: TurnState,
  playerName: string,
  soldierId: string,
  playerResources?: ResourceCount,
  payWith?: ResourceKey
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

  // Heal costs 1 card of either Wheat or Sheep — the player's choice.
  if (playerResources) {
    if (payWith !== undefined) {
      if (!HealSoldierResources.includes(payWith))
        return { allowed: false, reason: 'Heal is paid with Wheat or Sheep' };
      if ((playerResources[payWith] ?? 0) < 1)
        return { allowed: false, reason: `Not enough ${payWith} to heal` };
    } else if (!HealSoldierResources.some((r) => (playerResources[r] ?? 0) > 0)) {
      return { allowed: false, reason: 'You need 1 Wheat or 1 Sheep to heal' };
    }
  }

  return { allowed: true, reason: null };
}

/**
 * Authoritative soldier capture check (Rules.md "capture settlement/city"):
 * only during Action phase, on your turn, for one of your own soldiers
 * standing on a settlement you do not own, with no enemy or other troops
 * on the vertex (every troop present must be yours).
 */
export function canCaptureSettlementAt(
  board: Board,
  turn: TurnState,
  playerName: string,
  soldierId: string,
  vertexId: string
): BuildCheck {
  if (turn.player !== playerName) return { allowed: false, reason: 'Not your turn' };
  if (turn.phase !== 'Action')
    return { allowed: false, reason: 'Soldiers can only capture in the Action phase' };

  // Each soldier gets one action per Action phase (Rules.md line 30).
  if (turn.soldiersActedThisTurn.includes(soldierId))
    return { allowed: false, reason: 'This soldier already used its action this phase' };

  const soldier = board.soldiers[soldierId];
  if (!soldier) return { allowed: false, reason: 'Soldier not found' };
  if (soldier.owner !== playerName)
    return { allowed: false, reason: 'You can only capture with your own soldiers' };
  if (soldier.vertexId !== vertexId)
    return { allowed: false, reason: 'This soldier is not on that vertex' };
  if (soldier.injured)
    return { allowed: false, reason: 'Injured soldiers cannot capture' };

  const vertex = board.vertices[vertexId];
  if (!vertex || !vertex.settlementId)
    return { allowed: false, reason: 'No settlement on this vertex to capture' };
  const settlement = board.settlements[vertex.settlementId];
  if (!settlement) return { allowed: false, reason: 'Settlement not found' };
  if (settlement.ownerId === playerName)
    return { allowed: false, reason: 'You already own this settlement' };

  // Capturable only when no enemy or other troops are on the vertex:
  // every troop present must belong to the capturing player.
  const troopsHere = Object.values(board.soldiers).filter((s) => s.vertexId === vertexId);
  if (troopsHere.some((s) => s.owner !== playerName))
    return { allowed: false, reason: 'Enemy or other troops are on this vertex' };

  return { allowed: true, reason: null };
}

/**
 * Authoritative capture road transfer (Rules.md "capture settlement/city"):
 * when a player captures a settlement/city, the road(s) connecting the
 * captured vertex to any of the capturer's OTHER settlements/cities become
 * the capturer's. Returns the roads to transfer with their current owners
 * (so a capture undo can restore them).
 */
export function captureRoadTransfers(
  board: Board,
  capturingPlayer: string,
  capturedVertexId: string
): { roadId: string; originalOwnerId: string }[] {
  const myVertices = playerSettlementVertexIds(board, capturingPlayer).filter(
    (v) => v !== capturedVertexId
  );
  if (myVertices.length === 0) return [];
  const out: { roadId: string; originalOwnerId: string }[] = [];
  for (const edgeId of board.vertices[capturedVertexId]?.roadIds ?? []) {
    const edge = board.edges[edgeId];
    if (!edge || edge.roadId === null) continue;
    const other = edge.vertexAId === capturedVertexId ? edge.vertexBId : edge.vertexAId;
    if (!myVertices.includes(other)) continue;
    const road = board.roads[edge.roadId];
    if (!road) continue;
    out.push({ roadId: road.id, originalOwnerId: road.ownerId });
  }
  return out;
}
