/**
 * Build actions: settlements (incl. setup cities), roads (incl. free
 * Road-Building roads), city upgrades, soldier recruitment. The check half
 * comes from common's validators; the apply half (payment, piece creation,
 * per-turn tracking, undo entries, setup auto-advance) lives here beside it
 * so each action is the whole rule.
 */
import {
  applyPayouts,
  canBuildRoadOn,
  canBuildSettlementAt,
  canPlaceSetupCityAt,
  canRecruitSoldierAt,
  canUpgradeSettlementToCity,
  CityPrice,
  isSecondSetupRound,
  RoadPrice,
  SettlementPrice,
  setupSettlementPayouts,
  SoldierPrice,
  subtractPrice,
} from 'common';
import { advanceTurn } from '../turn';
import { GameRoom, Player } from 'common';
import type { ActionEntry } from '../dispatch';

const fail = (error: string) => ({ error });

const newSoldier = (owner: string, vertexId: string) => ({
  id: `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  owner,
  injured: false,
  vertexId,
  type: 'infantry' as const,
  stationed: true,
});

/** Setup auto-advance: both pieces placed ⇒ the next setup turn begins. */
function advanceIfSetupComplete(room: Parameters<typeof advanceTurn>[0]): void {
  const t = room.turnState;
  if (t.phase === 'SetUp' && t.placedSettlement && t.placedRoad) advanceTurn(room);
}

export const BUILD_ACTIONS: Record<string, ActionEntry> = {
  buildSettlement: {
    run: (room: GameRoom, player: Player, { vertexId, asCity }: { roomId: string; vertexId: string; asCity?: boolean }) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;
      const placeAsCity = asCity === true;

      const check = placeAsCity
        ? canPlaceSetupCityAt(board, turnState, player.name, vertexId, room.setupCities)
        : canBuildSettlementAt(board, turnState, player.name, vertexId, player.resources);
      if (!check.allowed) return fail(check.reason ?? 'Cannot build settlement here');

      if (turnState.phase === 'Build') {
        player.resources = subtractPrice(player.resources, SettlementPrice);
      }
      // Second setup round: the new settlement grants one of each resource
      // from its adjacent hexes (standard Catan starting resources).
      const setupGrant =
        turnState.phase === 'SetUp' &&
        isSecondSetupRound(turnState.offset, turnState.playerOrder.length)
          ? setupSettlementPayouts(board, vertexId, player.name)
          : [];
      applyPayouts(room.players, setupGrant);

      const vertex = board.vertices[vertexId];
      const newSettlementId = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      board.settlements[newSettlementId] = {
        id: newSettlementId,
        vertexId,
        ownerId: player.name,
        level: placeAsCity ? 'city' : 'settlement',
        builtAt: Date.now(),
      };
      vertex.settlementId = newSettlementId;

      // Garrison it: a settlement brings one soldier, a city one more.
      const soldierIds: string[] = [];
      for (let i = 0; i < (placeAsCity ? 2 : 1); i++) {
        const s = newSoldier(player.name, vertexId);
        board.soldiers[s.id] = s;
        turnState.soldiersCreatedThisTurn.push(s.id);
        turnState.soldiersActedThisTurn.push(s.id);
        soldierIds.push(s.id);
      }

      turnState.placedSettlement = true;
      turnState.undoLog.push({
        kind: 'buildSettlement',
        settlementId: newSettlementId,
        soldierId: soldierIds[0],
        vertexId,
        paid: turnState.phase === 'Build',
      });

      advanceIfSetupComplete(room);
    },
  },

  buildRoad: {
    run: (room: GameRoom, player: Player, { edgeId }: { roomId: string; edgeId: string }) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;

      // A free road from a played Road Building card skips the resource cost.
      const usingFreeRoad = player.freeRoadsLeft > 0;
      const check = canBuildRoadOn(
        board,
        turnState,
        player.name,
        edgeId,
        player.resources,
        usingFreeRoad
      );
      if (!check.allowed) return fail(check.reason ?? 'Cannot build road here');

      if (usingFreeRoad) {
        player.freeRoadsLeft--;
      } else if (turnState.phase === 'Build') {
        player.resources = subtractPrice(player.resources, RoadPrice);
      }
      const edge = board.edges[edgeId];
      const newRoadId = `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      board.roads[newRoadId] = {
        id: newRoadId,
        edgeId,
        ownerId: player.name,
        builtAt: Date.now(),
      };
      edge.roadId = newRoadId;
      // The generator already lists every adjacent edge in roadIds; only add
      // if missing so repeated road builds can't create duplicate entries.
      for (const vid of [edge.vertexAId, edge.vertexBId]) {
        const v = board.vertices[vid];
        if (v && !v.roadIds.includes(newRoadId)) v.roadIds.push(newRoadId);
      }

      turnState.placedRoad = true;
      turnState.undoLog.push({
        kind: 'buildRoad',
        roadId: newRoadId,
        edgeId,
        paid: turnState.phase === 'Build' && !usingFreeRoad,
        usedFreeRoad: usingFreeRoad,
      });

      advanceIfSetupComplete(room);
    },
  },

  upgradeSettlementToCity: {
    run: (room: GameRoom, player: Player, { vertexId }: { roomId: string; vertexId: string }) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;

      const check = canUpgradeSettlementToCity(
        board,
        turnState,
        player.name,
        vertexId,
        player.resources
      );
      if (!check.allowed) return fail(check.reason ?? 'Cannot upgrade settlement to city');

      player.resources = subtractPrice(player.resources, CityPrice);
      const vertex = board.vertices[vertexId];
      if (vertex?.settlementId) {
        const settlement = board.settlements[vertex.settlementId];
        if (settlement) settlement.level = 'city';
      }

      // Spawn an additional soldier garrisoned on the upgraded city.
      const s = newSoldier(player.name, vertexId);
      board.soldiers[s.id] = s;
      turnState.soldiersCreatedThisTurn.push(s.id);
      turnState.soldiersActedThisTurn.push(s.id);

      turnState.undoLog.push({
        kind: 'upgradeCity',
        settlementId: vertex?.settlementId ?? '',
        soldierId: s.id,
      });
    },
  },

  recruitSoldier: {
    run: (room: GameRoom, player: Player, { vertexId }: { roomId: string; vertexId: string }) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;

      const check = canRecruitSoldierAt(
        board,
        turnState,
        player.name,
        vertexId,
        player.resources
      );
      if (!check.allowed) return fail(check.reason ?? 'Cannot recruit soldier here');

      player.resources = subtractPrice(player.resources, SoldierPrice);
      const s = newSoldier(player.name, vertexId);
      board.soldiers[s.id] = s;
      // Track so it cannot move/attack this turn (Rules.md line 24), and a
      // fresh recruit has already used its action for this phase.
      turnState.soldiersCreatedThisTurn.push(s.id);
      turnState.soldiersActedThisTurn.push(s.id);

      turnState.undoLog.push({ kind: 'recruitSoldier', soldierId: s.id });
    },
  },
};
