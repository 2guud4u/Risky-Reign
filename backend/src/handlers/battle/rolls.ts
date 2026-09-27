import {
  canRollBattleDie,
  rollBattleDie,
  allSoldiersRolled,
  resolveBattleRoundIfComplete,
  applyBonuses,
} from 'common';
import { gameRooms } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, blockIfFinished } from '../context';
import { applyRobberFightOutcome, initialRepositionTurn } from './resolution';

/**
 * Battle-roll handler: rolling the die for one soldier during the rolling
 * phase; once every soldier on both sides has rolled, the round resolves.
 */
export function registerBattleRollHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  socket.on(
    'rollBattleDie',
    (data: { roomId: string; soldierId: string }) => {
      const { roomId, soldierId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfFinished(room, socket)) return;
      const board = room.board;
      if (!board || !room.battleState) {
        socket.emit('error', { message: 'No battle in progress' });
        return;
      }
      const currentPlayer = room.players.find((p) => p.id === socket.id);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      if (room.battleState.phase !== 'rolling') {
        socket.emit('error', { message: 'The battle is not in the rolling phase' });
        return;
      }
      const battle = room.battleState;
      const canRoll = canRollBattleDie(battle, currentPlayer.name, soldierId);
      if (!canRoll) {
        socket.emit('error', { message: 'Cannot roll for this soldier' });
        return;
      }

      // Roll the die and record the result.
      rollBattleDie(battle, currentPlayer.name, soldierId);

      // Once every soldier on both sides has rolled, resolve the round:
      // compute casualties and move to the betweenRounds phase.
      if (allSoldiersRolled(battle)) {
        room.battleState = resolveBattleRoundIfComplete(battle).updatedBattleState;
        // Robber fight: a single round. Once resolved, apply the outcome
        // (win → take the bag; lose → the soldier is killed) and end the
        // battle so the player can dismiss it.
        if (battle.robberFight) {
          applyRobberFightOutcome(io, room, battle);
          room.battleState = { ...room.battleState, phase: 'repositioning', repositionTurn: initialRepositionTurn(battle) };
        }
      }

      applyBonuses(room);
      broadcastRoom(io, room);
    }
  );
}
