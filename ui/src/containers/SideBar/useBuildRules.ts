import {
  Board,
  canBuildSettlementAt as checkSettlement,
  canBuildRoadOn as checkRoad,
  canUpgradeSettlementToCity as checkCity,
  canRecruitSoldierAt as checkSoldier,
  canMoveSoldierTo as checkMoveSoldier,
  canHealSoldierAt as checkHealSoldier,
  canCaptureSettlementAt as checkCaptureSettlement,
  canFightRobber as checkFightRobber,
} from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { UNLIMITED_RESOURCES } from '../../constants';

/**
 * Build eligibility rules for the sidebar panels. Delegates to the
 * authoritative checks in `common` (the same functions the backend enforces),
 * so the UI's "can I build?" hints can never drift from the server's rules.
 */
export function useBuildRules(board: Board) {
  const { gameRoom, currentPlayer } = useGameRoom();
  const turn = gameRoom?.turnState;
  const name = currentPlayer?.name ?? '';
  const resources = currentPlayer?.resources;

  const settlementCheck = (vertexId: string) =>
    turn ? checkSettlement(board, turn, name, vertexId, resources) : { allowed: false, reason: 'No active turn' };

  // A free road from a played Road Building card skips the resource cost.
  const hasFreeRoad = (currentPlayer?.freeRoadsLeft ?? 0) > 0;
  const roadCheck = (edgeId: string) =>
    turn
      ? checkRoad(
          board,
          turn,
          name,
          edgeId,
          hasFreeRoad ? UNLIMITED_RESOURCES : resources
        )
      : { allowed: false, reason: 'No active turn' };

  const cityCheck = (vertexId: string) =>
    turn ? checkCity(board, turn, name, vertexId, resources) : { allowed: false, reason: 'No active turn' };

  const soldierCheck = (vertexId: string) =>
    turn ? checkSoldier(board, turn, name, vertexId, resources) : { allowed: false, reason: 'No active turn' };

  const moveSoldierCheck = (soldierId: string, targetVertexId: string) =>
    turn
      ? checkMoveSoldier(board, turn, name, soldierId, targetVertexId)
      : { allowed: false, reason: 'No active turn' };

  const healSoldierCheck = (soldierId: string) =>
    turn ? checkHealSoldier(board, turn, name, soldierId, resources) : { allowed: false, reason: 'No active turn' };

  const captureCheck = (soldierId: string, vertexId: string) =>
    turn ? checkCaptureSettlement(board, turn, name, soldierId, vertexId) : { allowed: false, reason: 'No active turn' };

  const fightRobberCheck = (soldierId: string, vertexId: string) =>
    gameRoom ? checkFightRobber(gameRoom, name, soldierId, vertexId) : { allowed: false, reason: 'No active room' };

  const canBuildSettlementAt = (vertexId: string): boolean => settlementCheck(vertexId).allowed;
  const canBuildRoadOn = (edgeId: string): boolean => roadCheck(edgeId).allowed;
  const canUpgradeToCityAt = (vertexId: string): boolean => cityCheck(vertexId).allowed;
  const canRecruitSoldierAt = (vertexId: string): boolean => soldierCheck(vertexId).allowed;
  const canMoveSoldierTo = (soldierId: string, targetVertexId: string): boolean =>
    moveSoldierCheck(soldierId, targetVertexId).allowed;

  const canHealSoldierAt = (soldierId: string): boolean => healSoldierCheck(soldierId).allowed;

  const canCaptureSettlementAt = (soldierId: string, vertexId: string): boolean =>
    captureCheck(soldierId, vertexId).allowed;

  const canFightRobberAt = (soldierId: string, vertexId: string): boolean =>
    fightRobberCheck(soldierId, vertexId).allowed;

  return {
    canBuildSettlementAt,
    canBuildRoadOn,
    canUpgradeToCityAt,
    canRecruitSoldierAt,
    canMoveSoldierTo,
    canHealSoldierAt,
    canCaptureSettlementAt,
    canFightRobberAt,
  };
}
