import {
  Board,
  canBuildSettlementAt as checkSettlement,
  canBuildRoadOn as checkRoad,
  canUpgradeSettlementToCity as checkCity,
  canBuildSoldierAt as checkSoldier,
  canMoveSoldierTo as checkMoveSoldier,
  canHealSoldierAt as checkHealSoldier,
} from 'common';
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
  const resources = currentPlayer?.resources;

  const settlementCheck = (vertexId: string) =>
    turn ? checkSettlement(board, turn, name, vertexId, resources) : { allowed: false, reason: 'No active turn' };

  const roadCheck = (edgeId: string) =>
    turn ? checkRoad(board, turn, name, edgeId, resources) : { allowed: false, reason: 'No active turn' };

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

  const canBuildSettlementAt = (vertexId: string): boolean => settlementCheck(vertexId).allowed;
  const settlementReason = (vertexId: string): string =>
    settlementCheck(vertexId).reason ?? 'Cannot build settlement here';
  const canBuildRoadOn = (edgeId: string): boolean => roadCheck(edgeId).allowed;
  const roadReason = (edgeId: string): string => roadCheck(edgeId).reason ?? 'Cannot build road here';
  const canUpgradeToCityAt = (vertexId: string): boolean => cityCheck(vertexId).allowed;
  const upgradeReason = (vertexId: string): string => cityCheck(vertexId).reason ?? 'Cannot upgrade to a city here';
  const canBuildSoldierAt = (vertexId: string): boolean => soldierCheck(vertexId).allowed;
  const soldierReason = (vertexId: string): string =>
    soldierCheck(vertexId).reason ?? 'Cannot build a soldier here';
  const canMoveSoldierTo = (soldierId: string, targetVertexId: string): boolean =>
    moveSoldierCheck(soldierId, targetVertexId).allowed;
  const moveSoldierReason = (soldierId: string, targetVertexId: string): string =>
    moveSoldierCheck(soldierId, targetVertexId).reason ?? 'Cannot move soldier there';

  const canHealSoldierAt = (soldierId: string): boolean => healSoldierCheck(soldierId).allowed;
  const healSoldierReason = (soldierId: string): string =>
    healSoldierCheck(soldierId).reason ?? 'Cannot heal this soldier';

  return {
    canBuildSettlementAt,
    settlementReason,
    canBuildRoadOn,
    roadReason,
    canUpgradeToCityAt,
    upgradeReason,
    canBuildSoldierAt,
    soldierReason,
    canMoveSoldierTo,
    moveSoldierReason,
    canHealSoldierAt,
    healSoldierReason,
  };
}
