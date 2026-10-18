import { Board, VertexId } from '../types/Board';
import { TurnState, ResourceCount, BuildCheck, ResourceKey } from '../types/Logic';
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
 * Knight-card spawn check (Rules.md "Knight Dev Card"): the new soldier joins
 * a vertex where the player already has a soldier. Turn ownership and the
 * held card are checked by the caller (they live on the room, not the board).
 */
export function canKnightSpawnAt(board: Board, playerName: string, vertexId: VertexId): BuildCheck {
  if (!board.vertices[vertexId]) return { allowed: false, reason: 'Vertex not found' };
  const hasOwnSoldier = Object.values(board.soldiers).some(
    (s) => s.vertexId === vertexId && s.owner === playerName
  );
  if (!hasOwnSoldier)
    return { allowed: false, reason: 'A knight can only spawn where you already have a soldier' };
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
    return { allowed: false, reason: 'Defenders are still here — attack them first' };

  return { allowed: true, reason: null };
}

/**
 * Authoritative capture road transfer (Rules.md "capture settlement/city"):
 * when a player captures a settlement/city, every road reachable from the
 * captured vertex through empty vertices becomes the capturer's — the whole
 * road region the captured building anchors, including dead-end spurs (a
 * sandwiched chain may itself be a dead end). One exception: a road whose
 * far end is an enemy building stays the enemy's — capture never steals a
 * road up to their walls. Any building (mine or enemy) ends a chain. Roads
 * the capturer already owns are kept as-is. Returns the roads to transfer
 * with their current owners (so a capture undo can restore them).
 */
export function captureRoadTransfers(
  board: Board,
  capturingPlayer: string,
  capturedVertexId: string
): { roadId: string; originalOwnerId: string }[] {
  // BFS over the road graph: walk any road, but never through a vertex that
  // holds a building — that building anchors its own region.
  const reached = new Set<string>();
  const visited = new Set<string>([capturedVertexId]);
  const queue: string[] = [capturedVertexId];
  while (queue.length > 0) {
    const vertexId = queue.shift()!;
    for (const edgeId of board.vertices[vertexId]?.roadIds ?? []) {
      const edge = board.edges[edgeId];
      if (!edge || edge.roadId === null || !board.roads[edge.roadId]) continue;
      // Walls gate the flood-fill (Rules.md Walls): an enemy wall the fill
      // reaches transfers with its road, but the fill stops there — the
      // roads behind it stay theirs.
      const road = board.roads[edge.roadId];
      const enemyWall = !!road.isWall && road.ownerId !== capturingPlayer;
      const next = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
      const nextSettlement = board.vertices[next]?.settlementId;
      const enemyBuilt = !!nextSettlement && board.settlements[nextSettlement]?.ownerId !== capturingPlayer;
      if (!enemyBuilt) reached.add(edge.roadId);
      if (enemyWall || visited.has(next) || nextSettlement) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  const out: { roadId: string; originalOwnerId: string }[] = [];
  for (const roadId of reached) {
    const road = board.roads[roadId];
    if (road && road.ownerId !== capturingPlayer) out.push({ roadId, originalOwnerId: road.ownerId });
  }
  return out;
}
