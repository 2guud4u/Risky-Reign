import {
  applyBonuses,
  addPrice,
  SettlementPrice,
  RoadPrice,
  CityPrice,
  SoldierPrice,
  type TurnState,
} from 'common';
import { advanceTurn } from '../../turn';
import { gameRooms } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, blockIfCannotAct } from '../context';

/** Remove a soldier id from the per-turn tracking arrays (used by undo). */
function removeSoldierTracking(turnState: TurnState, soldierId: string): void {
  turnState.soldiersCreatedThisTurn = turnState.soldiersCreatedThisTurn.filter(
    (id) => id !== soldierId,
  );
  turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter(
    (id) => id !== soldierId,
  );
}

/**
 * Turn-flow handlers: ending the turn and undoing the acting player's most
 * recent action this phase.
 */
export function registerTurnFlowHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  socket.on('endTurn', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    // Only the acting player may end their turn, and not mid-battle.
    const caller = room.players.find((p) => p.id === socket.id);
    if (!caller) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    if (caller.name !== room.turnState.player) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    if (room.battleState) {
      socket.emit('error', { message: 'A battle is in progress' });
      return;
    }
    // Setup cannot be skipped: the current player must place both a
    // settlement and a road before their setup turn may end.
    if (
      room.turnState.phase === 'SetUp' &&
      (!room.turnState.placedSettlement || !room.turnState.placedRoad)
    ) {
      socket.emit('error', {
        message: 'Place a settlement and a road before ending setup',
      });
      return;
    }
    // The Dice phase advances automatically once both dice are rolled —
    // or, on a 7, once the robber has been moved and the steal resolved.
    if (room.turnState.phase === 'Dice') {
      socket.emit('error', {
        message:
          room.robberMove?.reason === 'seven'
            ? 'Move the robber before ending the Dice phase'
            : room.steal
              ? 'Resolve the steal before ending the Dice phase'
              : 'Roll both dice to end this phase',
      });
      return;
    }
    // A won robber fight must be resolved before the Action phase ends:
    // the winner moves the robber to an adjacent hex (Rules.md:18).
    if (
      room.turnState.phase === 'Action' &&
      room.robberDefeatedBy &&
      room.robberDefeatedBy.playerName === caller.name
    ) {
      socket.emit('error', {
        message: 'Move the robber to an adjacent hex before ending the Action phase',
      });
      return;
    }
    if (!room.board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    advanceTurn(room);
    // Notify all players in the room about the turn end.
    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // Undo the acting player's most recent action this phase (build or action).
  // Locked out once their turn advances: the log is cleared on every
  // `advanceTurn`, and the phase must match the entry kind.
  socket.on('undoBuild', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    // Only the acting player may undo, and never mid-battle (an undo could
    // teleport a soldier that's committed to an in-progress fight).
    const caller = room.players.find((p) => p.id === socket.id);
    if (!caller || caller.name !== room.turnState.player) {
      socket.emit('error', { message: 'Only the acting player can undo' });
      return;
    }
    if (room.battleState) {
      socket.emit('error', { message: 'A battle is in progress' });
      return;
    }
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    const turnState = room.turnState;
    const entry = turnState.undoLog[turnState.undoLog.length - 1];
    if (!entry) {
      socket.emit('error', { message: 'Nothing to undo' });
      return;
    }
    // Build-phase actions undo only during Build; action-phase actions only
    // during Action. A mismatch means the acting player's turn has ended.
    const isBuildEntry =
      entry.kind === 'buildSettlement' || entry.kind === 'buildRoad' || entry.kind === 'upgradeCity';
    if (turnState.phase !== (isBuildEntry ? 'Build' : 'Action')) {
      socket.emit('error', { message: 'Cannot undo after the turn has ended' });
      return;
    }
    const actingPlayer = room.players.find((p) => p.name === turnState.player);
    if (!actingPlayer) {
      socket.emit('error', { message: 'Acting player not found' });
      return;
    }

    // Pop the entry, then reverse its effects.
    turnState.undoLog.pop();
    switch (entry.kind) {
      case 'buildSettlement': {
        if (entry.paid) actingPlayer.resources = addPrice(actingPlayer.resources, SettlementPrice);
        delete board.settlements[entry.settlementId];
        const vertex = board.vertices[entry.vertexId];
        if (vertex && vertex.settlementId === entry.settlementId) vertex.settlementId = null;
        delete board.soldiers[entry.soldierId];
        removeSoldierTracking(turnState, entry.soldierId);
        break;
      }
      case 'buildRoad': {
        if (entry.usedFreeRoad) actingPlayer.freeRoadsLeft += 1;
        else if (entry.paid) actingPlayer.resources = addPrice(actingPlayer.resources, RoadPrice);
        delete board.roads[entry.roadId];
        const edge = board.edges[entry.edgeId];
        if (edge && edge.roadId === entry.roadId) edge.roadId = null;
        for (const vid of [edge?.vertexAId, edge?.vertexBId]) {
          const v = vid ? board.vertices[vid] : undefined;
          if (v) v.roadIds = v.roadIds.filter((id) => id !== entry.edgeId);
        }
        break;
      }
      case 'upgradeCity': {
        actingPlayer.resources = addPrice(actingPlayer.resources, CityPrice);
        const settlement = board.settlements[entry.settlementId];
        if (settlement) settlement.level = 'settlement';
        delete board.soldiers[entry.soldierId];
        removeSoldierTracking(turnState, entry.soldierId);
        break;
      }
      case 'recruitSoldier': {
        actingPlayer.resources = addPrice(actingPlayer.resources, SoldierPrice);
        delete board.soldiers[entry.soldierId];
        removeSoldierTracking(turnState, entry.soldierId);
        break;
      }
      case 'moveSoldier': {
        const soldier = board.soldiers[entry.soldierId];
        if (soldier) soldier.vertexId = entry.originalVertexId;
        // Refund the action so the soldier can move/attack again this phase.
        turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter(
          (id) => id !== entry.soldierId,
        );
        break;
      }
      case 'captureSettlement': {
        const settlement = board.settlements[entry.settlementId];
        if (settlement) settlement.ownerId = entry.originalOwnerId;
        // Restore the roads that transferred to the capturer.
        for (const t of entry.roadTransfers ?? []) {
          const road = board.roads[t.roadId];
          if (road) road.ownerId = t.originalOwnerId;
        }
        // Refund the action so the capturing soldier can act again this phase.
        turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter((x) => x !== entry.soldierId);
        break;
      }
    }

    applyBonuses(room);
    broadcastRoom(io, room);
  });
}
