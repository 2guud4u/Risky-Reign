import { Board, VertexId } from '../types/Board';
import { TurnState, BuildCheck } from '../types/Logic';

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
  // Rule 49: a stationed cannon must be unstationed before it can move. (Only
  // cannons station/unstation; infantry's stationed flag is incidental.)
  if (soldier.type === 'cannon' && soldier.stationed) {
    return { allowed: false, reason: 'A stationed cannon must be unstationed before moving' };
  }

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
