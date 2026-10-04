import { canStartBattle, createBattleState } from 'common';
import { gameRooms } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, blockIfCannotAct } from '../context';

/**
 * Battle-start handler: beginning an attack on a vertex (or a robber
 * fight), which creates the battle state and moves the room into battle.
 */
export function registerBattleAttackHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  socket.on(
    'startAttack',
    (data: { roomId: string; soldierIds: string[]; targetVertexId: string; defenderName?: string }) => {
      const { roomId, soldierIds, targetVertexId, defenderName } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfCannotAct(room, socket)) return;
      const board = room.board;
      if (!board) {
        socket.emit('error', { message: 'Game board is not available' });
        return;
      }
      const turnState = room.turnState;
      const currentPlayer = room.players.find((p) => p.id === socket.id);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      // A battle can only be started during the Action phase, on your turn.
      if (turnState.phase !== 'Action' || turnState.player !== currentPlayer.name) {
        socket.emit('error', { message: 'You can only start a battle on your turn in the Action phase' });
        return;
      }
      // A battle can only be started if no battle is already in progress.
      if (room.battleState) {
        socket.emit('error', { message: 'A battle is already in progress' });
        return;
      }

      // Authoritative rules live in common (shared with the UI).
      const check = canStartBattle(room, currentPlayer.name, soldierIds, targetVertexId, defenderName);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot start a battle here' });
        return;
      }

      // Create the battle state and move to the battle phase.
      room.battleState = createBattleState(room, currentPlayer.name, soldierIds, targetVertexId, defenderName);

      // Track the soldiers as having acted (Rules.md line 30).
      for (const sid of soldierIds) {
        turnState.soldiersActedThisTurn.push(sid);
      }

      broadcastRoom(io, room);
    }
  );
}
