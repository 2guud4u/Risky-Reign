import { BattleState, Board } from '../../index';

/**
 * Post-battle repositioning rules (Rules.md: "attacker gets to move injured
 * soldiers away first"). Every injured survivor MUST leave the battle vertex
 * along a road to a neighboring vertex — one step — unless there is no road
 * out, in which case it stays where it fell.
 */

/** Neighboring vertices reachable from `vertexId` via an existing road. */
export function roadNeighbors(board: Board, vertexId: string): string[] {
  const v = board.vertices[vertexId];
  if (!v) return [];
  const targets: string[] = [];
  for (const edgeId of v.roadIds) {
    const edge = board.edges[edgeId];
    if (!edge || edge.roadId === null) continue;
    const other = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
    if (other !== vertexId) targets.push(other);
  }
  return targets;
}

/**
 * Ids of `sideName`'s living injured troops that still have to move: they
 * are on the battle vertex and the battle vertex has a road out.
 */
export function injuredLeftToMove(board: Board, battle: BattleState, sideName: string): string[] {
  if (roadNeighbors(board, battle.vertexId).length === 0) return [];
  return (battle.states[sideName]?.soldiers ?? [])
    .filter((s) => s.injured && !s.dead && board.soldiers[s.soldier.id]?.vertexId === battle.vertexId)
    .map((s) => s.soldier.id);
}

/**
 * The repositioning turn after `current` finishes (null = start): the
 * attacker first, then the defender. A side with nothing to move is
 * skipped; null once no side has troops left to move.
 */
export function nextRepositionTurn(
  board: Board,
  battle: BattleState,
  current: 'attacker' | 'defender' | null
): 'attacker' | 'defender' | null {
  if (current === null && injuredLeftToMove(board, battle, battle.attacker).length > 0) return 'attacker';
  if (current !== 'defender' && battle.defender && injuredLeftToMove(board, battle, battle.defender).length > 0)
    return 'defender';
  return null;
}
