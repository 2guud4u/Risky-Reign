import { Board, playerSettlementVertexIds } from 'common';
import { useGameRoom } from '../../contexts/GameContext';

/**
 * Build eligibility rules shared by the sidebar panels — mirrors the checks
 * the backend enforces (turn, phase, once-per-turn placement, distance and
 * ownership rules).
 */
export function useBuildRules(board: Board) {
  const { gameRoom, currentPlayer } = useGameRoom();
  const turn = gameRoom?.turnState;

  const isMyTurn = !!(turn && currentPlayer && turn.player === currentPlayer.name);
  const inBuildPhase = turn?.phase === 'SetUp' || turn?.phase === 'Build';
  const ownedSettlementVertexIds = currentPlayer
    ? playerSettlementVertexIds(board, currentPlayer.name)
    : [];

  const hasAdjacentSettlement = (vertexId: string): boolean => {
    const vertex = board.vertices[vertexId];
    if (!vertex) return false;
    return vertex.roadIds.some((edgeId) => {
      const edge = board.edges[edgeId];
      if (!edge) return false;
      const otherId = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
      return board.vertices[otherId]?.settlementId !== null;
    });
  };

  const canBuildSettlementAt = (vertexId: string): boolean => {
    const vertex = board.vertices[vertexId];
    if (!vertex || !turn) return false;
    return (
      isMyTurn &&
      inBuildPhase &&
      turn.placedSettlement !== true &&
      vertex.settlementId === null &&
      !hasAdjacentSettlement(vertexId)
    );
  };

  const settlementReason = (vertexId: string): string => {
    if (!isMyTurn) return 'Not your turn';
    if (!inBuildPhase) return 'Only available in SetUp/Build phase';
    if (turn?.placedSettlement === true) return 'Settlement already placed this turn';
    if (board.vertices[vertexId]?.settlementId !== null) return 'Vertex already occupied';
    return 'Too close to an existing settlement';
  };

  const canBuildRoadOn = (edgeId: string): boolean => {
    const edge = board.edges[edgeId];
    if (!edge || !turn) return false;
    return (
      isMyTurn &&
      inBuildPhase &&
      turn.placedRoad !== true &&
      edge.roadId === null &&
      (ownedSettlementVertexIds.includes(edge.vertexAId) ||
        ownedSettlementVertexIds.includes(edge.vertexBId))
    );
  };

  const roadReason = (edgeId: string): string => {
    if (!isMyTurn) return 'Not your turn';
    if (!inBuildPhase) return 'Only available in SetUp/Build phase';
    if (turn?.placedRoad === true) return 'Road already placed this turn';
    if (board.edges[edgeId]?.roadId !== null) return 'A road already exists on this edge';
    return 'Edge must touch one of your settlements';
  };

  return { canBuildSettlementAt, settlementReason, canBuildRoadOn, roadReason };
}
