import {
  canBuildSettlementAt,
  canBuildRoadOn,
  canUpgradeSettlementToCity,
  canRecruitSoldierAt,
  subtractPrice,
  SettlementPrice,
  RoadPrice,
  CityPrice,
  SoldierPrice,
  applyBonuses,
} from 'common';
import { advanceTurn } from '../turn';
import { gameRooms } from '../store';
import { HandlerContext, blockIfFinished } from './context';

/**
 * Building handlers: settlements, roads (including free Road-Building roads),
 * city upgrades, and soldier recruitment.
 */
export function registerBuildHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  socket.on('buildSettlement', (data: { roomId: string; playerId: string; vertexId: string }) => {
    const { roomId, playerId, vertexId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    const turnState = room.turnState;
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (!currentPlayer) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    // Authoritative rules live in common (shared with the UI).
    const check = canBuildSettlementAt(board, turnState, currentPlayer.name, vertexId, currentPlayer.resources);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot build settlement here' });
      return;
    }

    // Deduct resources in Build phase (after setup)
    if (turnState.phase === 'Build') {
      currentPlayer.resources = subtractPrice(currentPlayer.resources, SettlementPrice);
    }
    const vertex = board.vertices[vertexId];
    const newSettlementId = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    board.settlements[newSettlementId] = {
      id: newSettlementId,
      vertexId,
      ownerId: currentPlayer.name,
      level: 'settlement',
      builtAt: Date.now(),
    };
    vertex.settlementId = newSettlementId;

    // Spawn a default soldier garrisoned on the new settlement.
    const newSoldierId = `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    board.soldiers[newSoldierId] = {
      id: newSoldierId,
      owner: currentPlayer.name,
      injured: false,
      vertexId,
      type: 'infantry',
      stationed: true,
    };
    // Track so it cannot move/attack this turn (Rule 24).
    turnState.soldiersCreatedThisTurn.push(newSoldierId);
    turnState.soldiersActedThisTurn.push(newSoldierId);

    // Update the game state.
    turnState.placedSettlement = true;

    // Record the build so it can be undone (refunds the cost, deletes the
    // settlement and its garrisoned soldier). Free setup placements are
    // cleared by the auto-advance below, so only paid Build builds persist.
    turnState.undoLog.push({
      kind: 'buildSettlement',
      settlementId: newSettlementId,
      soldierId: newSoldierId,
      vertexId,
      paid: turnState.phase === 'Build',
    });

    // In SetUp, auto-advance once both a settlement and a road are placed.
    if (room.turnState.phase === 'SetUp' && room.turnState.placedSettlement && room.turnState.placedRoad) {
      advanceTurn(room);
    }
    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  socket.on('buildRoad', (data: { roomId: string; playerId: string; edgeId: string }) => {
    const { roomId, playerId, edgeId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    const turnState = room.turnState;
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (!currentPlayer) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    // Authoritative rules live in common (shared with the UI). A free road
    // from a played Road Building card skips the resource cost.
    const usingFreeRoad = currentPlayer.freeRoadsLeft > 0;
    const check = canBuildRoadOn(
      board,
      turnState,
      currentPlayer.name,
      edgeId,
      usingFreeRoad ? { Wood: 99, Brick: 99, Sheep: 99, Wheat: 99, Ore: 99 } : currentPlayer.resources
    );
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot build road here' });
      return;
    }

    // Deduct resources in Build phase (after setup), unless it's a free road.
    if (usingFreeRoad) {
      currentPlayer.freeRoadsLeft--;
    } else if (turnState.phase === 'Build') {
      currentPlayer.resources = subtractPrice(currentPlayer.resources, RoadPrice);
    }
    const edge = board.edges[edgeId];
    const newRoadId = `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    board.roads[newRoadId] = {
      id: newRoadId,
      edgeId,
      ownerId: currentPlayer.name,
      builtAt: Date.now(),
    };
    edge.roadId = newRoadId;
    // The generator already lists every adjacent edge in roadIds; only add
    // if missing so repeated road builds can't create duplicate entries.
    for (const vid of [edge.vertexAId, edge.vertexBId]) {
      const v = board.vertices[vid];
      if (v && !v.roadIds.includes(edgeId)) v.roadIds.push(edgeId);
    }

    turnState.placedRoad = true;

    // Record the road so it can be undone (refunds the cost or restores the
    // free road, deletes the road). Free setup placements are cleared by the
    // auto-advance below.
    turnState.undoLog.push({
      kind: 'buildRoad',
      roadId: newRoadId,
      edgeId,
      usedFreeRoad: usingFreeRoad,
      paid: turnState.phase === 'Build',
    });
    if (room.turnState.phase === 'SetUp' && room.turnState.placedSettlement && room.turnState.placedRoad) {
      advanceTurn(room);
    }
    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  socket.on('upgradeSettlementToCity', (data: { roomId: string; playerId: string; vertexId: string }) => {
    const { roomId, playerId, vertexId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    const turnState = room.turnState;
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (!currentPlayer) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    // Authoritative rules live in common (shared with the UI).
    const check = canUpgradeSettlementToCity(board, turnState, currentPlayer.name, vertexId, currentPlayer.resources);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot upgrade settlement to city' });
      return;
    }

    // Deduct resources and upgrade the settlement.
    currentPlayer.resources = subtractPrice(currentPlayer.resources, CityPrice);
    const vertex = board.vertices[vertexId];
    if (vertex && vertex.settlementId) {
      const settlement = board.settlements[vertex.settlementId];
      if (settlement) {
        settlement.level = 'city';
      }
    }

    // Spawn an additional soldier garrisoned on the upgraded city.
    const newSoldierId = `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    board.soldiers[newSoldierId] = {
      id: newSoldierId,
      owner: currentPlayer.name,
      injured: false,
      vertexId,
      type: 'infantry',
      stationed: true,
    };
    // Track so it cannot move/attack this turn (Rule 24).
    turnState.soldiersCreatedThisTurn.push(newSoldierId);
    turnState.soldiersActedThisTurn.push(newSoldierId);

    // Record the upgrade so it can be undone (refunds the cost, reverts the
    // settlement to a settlement, deletes the extra garrisoned soldier).
    turnState.undoLog.push({
      kind: 'upgradeCity',
      settlementId: vertex?.settlementId ?? '',
      soldierId: newSoldierId,
    });

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  socket.on('recruitSoldier', (data: { roomId: string; playerId: string; vertexId: string }) => {
    const { roomId, playerId, vertexId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    const turnState = room.turnState;
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (!currentPlayer) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    // Authoritative rules live in common (shared with the UI).
    const check = canRecruitSoldierAt(board, turnState, currentPlayer.name, vertexId, currentPlayer.resources);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot recruit soldier here' });
      return;
    }

    // Deduct resources and garrison the soldier on the settlement.
    currentPlayer.resources = subtractPrice(currentPlayer.resources, SoldierPrice);
    const newSoldierId = `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    board.soldiers[newSoldierId] = {
      id: newSoldierId,
      owner: currentPlayer.name,
      injured: false,
      vertexId,
      type: 'infantry',
      stationed: true,
    };

    // Track this soldier so it cannot move/attack this turn (Rules.md line 24).
    turnState.soldiersCreatedThisTurn.push(newSoldierId);

    // A freshly recruited soldier has used its action for this phase.
    turnState.soldiersActedThisTurn.push(newSoldierId);

    // Record the recruitment so it can be undone (refunds the cost, deletes
    // the soldier, and clears its tracking so it is no longer considered recruited).
    turnState.undoLog.push({
      kind: 'recruitSoldier',
      soldierId: newSoldierId,
    });

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });
}
