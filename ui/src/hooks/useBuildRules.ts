import {
  Board,
  BuildCheck,
  ResourceKey,
  canBuildSettlementAt as checkSettlement,
  canPlaceSetupCityAt as checkSetupCity,
  canBuildRoadOn as checkRoad,
  canUpgradeSettlementToCity as checkCity,
  canRecruitSoldierAt as checkSoldier,
  canHealSoldierAt as checkHealSoldier,
  canCaptureSettlementAt as checkCaptureSettlement,
  canFightRobber as checkFightRobber,
  canStartBattle as checkStartBattle,
} from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { UNLIMITED_RESOURCES } from '../constants';

/**
 * Build and soldier-action eligibility rules for the UI. Delegates to the
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

  // Setup only: place a city directly (room's setupCities setting).
  const setupCityCheck = (vertexId: string) =>
    turn && gameRoom
      ? checkSetupCity(board, turn, name, vertexId, gameRoom.setupCities)
      : { allowed: false, reason: 'No active turn' };

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

  const healSoldierCheck = (soldierId: string, payWith?: ResourceKey) =>
    turn
      ? checkHealSoldier(board, turn, name, soldierId, resources, payWith)
      : { allowed: false, reason: 'No active turn' };

  const captureCheck = (soldierId: string, vertexId: string) =>
    turn ? checkCaptureSettlement(board, turn, name, soldierId, vertexId) : { allowed: false, reason: 'No active turn' };

  // The battle checks report `reason?: string`; normalize to BuildCheck.
  const fightRobberCheck = (soldierId: string, vertexId: string): BuildCheck => {
    if (!gameRoom) return { allowed: false, reason: 'No active room' };
    const { allowed, reason } = checkFightRobber(gameRoom, name, soldierId, vertexId);
    return { allowed, reason: reason ?? null };
  };

  const attackCheck = (soldierIds: string[], vertexId: string, defenderName?: string): BuildCheck => {
    if (!gameRoom) return { allowed: false, reason: 'No active room' };
    if (gameRoom.battleState) return { allowed: false, reason: 'A battle is already in progress' };
    const { allowed, reason } = checkStartBattle(gameRoom, name, soldierIds, vertexId, defenderName);
    return { allowed, reason: reason ?? null };
  };

  return {
    settlementCheck,
    setupCityCheck,
    roadCheck,
    cityCheck,
    soldierCheck,
    healSoldierCheck,
    captureCheck,
    fightRobberCheck,
    attackCheck,
  };
}
