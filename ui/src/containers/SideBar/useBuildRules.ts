import { Board, canBuildSettlementAt as checkSettlement, canBuildRoadOn as checkRoad } from 'common';
import { useGameRoom } from '../../contexts/GameContext';

/**
 * Build eligibility rules for the sidebar panels. Delegates to the
 * authoritative checks in `common` (the same functions the backend enforces),
 * so the UI's "can I build?" hints can never drift from the server's rules.
 */
export function useBuildRules(board: Board) {
  const { gameRoom, currentPlayer } = useGameRoom();
  const turn = gameRoom?.turnState;
  const name = currentPlayer?.name ?? '';

  const settlementCheck = (vertexId: string) =>
    turn ? checkSettlement(board, turn, name, vertexId) : { allowed: false, reason: 'No active turn' };

  const roadCheck = (edgeId: string) =>
    turn ? checkRoad(board, turn, name, edgeId) : { allowed: false, reason: 'No active turn' };

  const canBuildSettlementAt = (vertexId: string): boolean => settlementCheck(vertexId).allowed;
  const settlementReason = (vertexId: string): string =>
    settlementCheck(vertexId).reason ?? 'Cannot build settlement here';
  const canBuildRoadOn = (edgeId: string): boolean => roadCheck(edgeId).allowed;
  const roadReason = (edgeId: string): string => roadCheck(edgeId).reason ?? 'Cannot build road here';

  return { canBuildSettlementAt, settlementReason, canBuildRoadOn, roadReason };
}
