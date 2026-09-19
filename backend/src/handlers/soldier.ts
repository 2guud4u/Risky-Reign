import {
  canMoveSoldierTo,
  canHealSoldierAt,
  canCaptureSettlementAt,
  canFightRobber,
  rollDie,
  subtractPrice,
  HealSoldierPrice,
  RESOURCES,
  applyBonuses,
} from 'common';
import { gameRooms } from '../store';
import { HandlerContext, blockIfFinished } from './context';

/**
 * Soldier handlers: moving a garrisoned soldier, healing one, capturing a
 * settlement/city with a group, and fighting the robber 1v1.
 */
export function registerSoldierHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  socket.on('moveSoldier', (data: { roomId: string; playerId: string; soldierId: string; targetVertexId: string }) => {
    const { roomId, playerId, soldierId, targetVertexId } = data;
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
    const check = canMoveSoldierTo(board, turnState, currentPlayer.name, soldierId, targetVertexId);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot move soldier there' });
      return;
    }

    // Move the soldier to the new vertex.
    const soldier = board.soldiers[soldierId];
    if (soldier) {
      const originalVertexId = soldier.vertexId;
      soldier.vertexId = targetVertexId;

      // Record the move so it can be undone (returns the soldier to its
      // original vertex and refunds its action for this phase).
      turnState.undoLog.push({
        kind: 'moveSoldier',
        soldierId,
        originalVertexId,
      });
    }

    // Each soldier gets one action per Action phase (Rules.md line 30).
    turnState.soldiersActedThisTurn.push(soldierId);

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  socket.on(
    'captureSettlement',
    (data: { roomId: string; playerId: string; soldierIds: string[]; vertexId: string }) => {
      const { roomId, playerId, soldierIds, vertexId } = data;
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

      // Authoritative rules live in common (shared with the UI). Every
      // capturing soldier must pass the check (own, on the vertex, no
      // enemy or other troops there, action still available).
      for (const soldierId of soldierIds) {
        const check = canCaptureSettlementAt(board, turnState, currentPlayer.name, soldierId, vertexId);
        if (!check.allowed) {
          socket.emit('error', { message: check.reason ?? 'Cannot capture this settlement' });
          return;
        }
      }

      // Transfer the settlement/city to the acting player, recording the
      // previous owner so the capture can be undone this phase.
      const vertex = board.vertices[vertexId];
      const settlement = vertex?.settlementId ? board.settlements[vertex.settlementId] : undefined;
      if (settlement) {
        turnState.undoLog.push({
          kind: 'captureSettlement',
          settlementId: settlement.id,
          originalOwnerId: settlement.ownerId,
          soldierIds: [...soldierIds],
        });
        settlement.ownerId = currentPlayer.name;
      }

      // Each capturing soldier gets one action per Action phase (Rules.md line 30).
      for (const soldierId of soldierIds) {
        turnState.soldiersActedThisTurn.push(soldierId);
      }

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );

  socket.on('healSoldier', (data: { roomId: string; playerId: string; soldierId: string }) => {
    const { roomId, playerId, soldierId } = data;
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
    const check = canHealSoldierAt(board, turnState, currentPlayer.name, soldierId, currentPlayer.resources);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot heal this soldier' });
      return;
    }

    // Deduct healing cost and restore the soldier (Rules.md line 27).
    currentPlayer.resources = subtractPrice(currentPlayer.resources, HealSoldierPrice);
    const soldier = board.soldiers[soldierId];
    if (soldier) {
      soldier.injured = false;
    }

    // Track this soldier so it cannot move this turn (Rules.md line 25).
    turnState.soldiersHealedThisTurn.push(soldierId);

    // Healing consumes the soldier's action for this phase.
    turnState.soldiersActedThisTurn.push(soldierId);

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  socket.on('fightRobber', (data: { roomId: string; playerId: string; soldierId: string; vertexId: string }) => {
    const { roomId, playerId, soldierId, vertexId } = data;
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
    const check = canFightRobber(room, currentPlayer.name, soldierId, vertexId);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot fight the robber here' });
      return;
    }

    const soldier = board.soldiers[soldierId];

    // 1v1 roll: the soldier's die vs the robber's die; the robber wins
    // ties (Rules.md line 20).
    const soldierRoll = rollDie();
    const robberRoll = rollDie();
    const won = soldierRoll > robberRoll;

    // Record for undo: restore the soldier if it was killed, return the
    // bag if it was won.
    turnState.undoLog.push({
      kind: 'fightRobber',
      playerName: currentPlayer.name,
      soldierId,
      result: won ? 'win' : 'lose',
      soldierSnapshot: { ...soldier },
      bagBefore: { ...room.robberBag },
    });

    if (won) {
      // The winner takes the entire robber bag.
      for (const r of RESOURCES) {
        currentPlayer.resources[r] += room.robberBag[r];
      }
      room.robberBag = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };
    } else {
      // The robber kills the soldier.
      delete board.soldiers[soldierId];
    }

    // The fight consumes the soldier's action for this phase and the
    // player's once-per-phase robber fight.
    turnState.soldiersActedThisTurn.push(soldierId);
    turnState.robberFoughtThisPhase.push(currentPlayer.name);

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
    io.to(roomId).emit('robberFightResult', {
      playerName: currentPlayer.name,
      soldierId,
      soldierRoll,
      robberRoll,
      won,
    });
  });
}
