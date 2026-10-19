import {
  Board,
  BuildCheck,
  PublicGameRoom,
  PublicPlayer,
  ResourceKey,
  canBuildRoadOn,
  canBuildSettlementAt,
  canBuildShip,
  canCannonAttack,
  canCannonAttackWall,
  canCannonSplash,
  canCaptureSettlementAt,
  canConvertShipToSettlement,
  canDisembarkSoldier,
  canDowngradeCannon,
  canEmbarkSoldier,
  canFightRobber,
  canHealSoldierAt,
  canMoveShip,
  canPlaceSetupCityAt,
  canRecruitSoldierAt,
  canStartBattle,
  canStationCannon,
  canUnstationCannon,
  canUpgradeCannon,
  canUpgradeRoadToWall,
  canUpgradeSettlementToCity,
} from 'common';
import { NO_TURN, asDomain } from './types';

/**
 * The eligibility rules the bubbles report, delegating to the authoritative
 * checks in `common` (the same functions the backend enforces), so the UI's
 * "can I build?" hints can never drift from the server's rules.
 */
export interface BoardRules {
  /** A played Road Building card makes the next roads free (cost + spend animation skip). */
  hasFreeRoad: boolean;
  settlementCheck: (vertexId: string) => BuildCheck;
  /** Setup only: place a city directly (room's setupCities setting). */
  setupCityCheck: (vertexId: string) => BuildCheck;
  /** A free road from a played Road Building card skips the resource cost. */
  roadCheck: (edgeId: string) => BuildCheck;
  cityCheck: (vertexId: string) => BuildCheck;
  soldierCheck: (vertexId: string) => BuildCheck;
  healSoldierCheck: (soldierId: string, payWith?: ResourceKey) => BuildCheck;
  captureCheck: (soldierId: string, vertexId: string) => BuildCheck;
  fightRobberCheck: (soldierId: string, vertexId: string) => BuildCheck;
  attackCheck: (soldierIds: string[], vertexId: string, defenderName?: string) => BuildCheck;
  upgradeCannonCheck: (soldierId: string) => BuildCheck;
  downgradeCannonCheck: (soldierId: string) => BuildCheck;
  stationCannonCheck: (soldierId: string) => BuildCheck;
  unstationCannonCheck: (soldierId: string) => BuildCheck;
  cannonAttackCheck: (soldierId: string, targetSoldierId: string) => BuildCheck;
  cannonSplashCheck: (soldierId: string, vertexId: string) => BuildCheck;
  cannonWallCheck: (soldierId: string, edgeId: string) => BuildCheck;
  wallCheck: (edgeId: string) => BuildCheck;
  buildShipCheck: (vertexId: string) => BuildCheck;
  moveShipCheck: (shipId: string, vertexId: string) => BuildCheck;
  embarkCheck: (soldierId: string, shipId: string) => BuildCheck;
  disembarkCheck: (soldierId: string, vertexId: string) => BuildCheck;
  convertShipCheck: (shipId: string, vertexId: string) => BuildCheck;
}

export const makeRules = (room: PublicGameRoom, board: Board, me: PublicPlayer): BoardRules => {
  const turn = room.turnState;
  const name = me.name;
  const resources = me.resources;
  const hasFreeRoad = me.freeRoadsLeft > 0;
  const { asRoom, asMe } = asDomain(room, me);
  return {
    hasFreeRoad,
    settlementCheck: (vertexId) =>
      turn ? canBuildSettlementAt(board, turn, name, vertexId, resources) : NO_TURN,
    setupCityCheck: (vertexId) =>
      turn ? canPlaceSetupCityAt(board, turn, name, vertexId, room.setupCities) : NO_TURN,
    roadCheck: (edgeId) =>
      turn
        ? canBuildRoadOn(board, turn, name, edgeId, resources, hasFreeRoad)
        : NO_TURN,
    cityCheck: (vertexId) =>
      turn ? canUpgradeSettlementToCity(board, turn, name, vertexId, resources) : NO_TURN,
    soldierCheck: (vertexId) =>
      turn ? canRecruitSoldierAt(board, turn, name, vertexId, resources) : NO_TURN,
    healSoldierCheck: (soldierId, payWith) =>
      turn ? canHealSoldierAt(board, turn, name, soldierId, resources, payWith) : NO_TURN,
    captureCheck: (soldierId, vertexId) =>
      turn ? canCaptureSettlementAt(board, turn, name, soldierId, vertexId) : NO_TURN,
    // The battle checks report `reason?: string`; normalize to BuildCheck.
    fightRobberCheck: (soldierId, vertexId) => {
      const { allowed, reason } = canFightRobber(room, name, soldierId, vertexId);
      return { allowed, reason: reason ?? null };
    },
    attackCheck: (soldierIds, vertexId, defenderName) => {
      if (room.battleState) return { allowed: false, reason: 'A battle is already in progress' };
      const { allowed, reason } = canStartBattle(room, name, soldierIds, vertexId, defenderName);
      return { allowed, reason: reason ?? null };
    },
    // The piece rules take the full GameRoom/Player; the public room and
    // this seat carry every field those checks read.
    upgradeCannonCheck: (soldierId) => canUpgradeCannon(asRoom, asMe, soldierId),
    downgradeCannonCheck: (soldierId) => canDowngradeCannon(asRoom, asMe, soldierId),
    stationCannonCheck: (soldierId) => canStationCannon(asRoom, asMe, soldierId),
    unstationCannonCheck: (soldierId) => canUnstationCannon(asRoom, asMe, soldierId),
    cannonAttackCheck: (soldierId, targetSoldierId) =>
      canCannonAttack(asRoom, asMe, soldierId, targetSoldierId),
    cannonSplashCheck: (soldierId, vertexId) =>
      canCannonSplash(asRoom, asMe, soldierId, vertexId),
    cannonWallCheck: (soldierId, edgeId) =>
      canCannonAttackWall(asRoom, asMe, soldierId, edgeId),
    wallCheck: (edgeId) => canUpgradeRoadToWall(asRoom, asMe, edgeId),
    buildShipCheck: (vertexId) => canBuildShip(asRoom, asMe, vertexId),
    moveShipCheck: (shipId, vertexId) => canMoveShip(asRoom, asMe, shipId, vertexId),
    embarkCheck: (soldierId, shipId) => canEmbarkSoldier(asRoom, asMe, soldierId, shipId),
    disembarkCheck: (soldierId, vertexId) =>
      canDisembarkSoldier(asRoom, asMe, soldierId, vertexId),
    convertShipCheck: (shipId, vertexId) =>
      canConvertShipToSettlement(asRoom, asMe, shipId, vertexId),
  };
};

/**
 * Nothing at all can be built this Build phase: no vertex takes a
 * settlement or city, and no edge takes a road (free Road Building roads
 * count). Used for the "end your turn" hint finger; the per-spot checks are
 * the same authoritative ones the bubbles use.
 */
export function nothingBuildable(room: PublicGameRoom, me: PublicPlayer): boolean {
  const board = room.board;
  const turn = room.turnState;
  if (!board || !turn || turn.phase !== 'Build') return false;
  const rules = makeRules(room, board, me);
  for (const vertexId of Object.keys(board.vertices)) {
    if (rules.settlementCheck(vertexId).allowed || rules.cityCheck(vertexId).allowed) return false;
    if (room.shipsEnabled && rules.buildShipCheck(vertexId).allowed) return false;
  }
  for (const edgeId of Object.keys(board.edges)) {
    if (rules.roadCheck(edgeId).allowed) return false;
    if (room.wallsEnabled && rules.wallCheck(edgeId).allowed) return false;
  }
  return true;
}
