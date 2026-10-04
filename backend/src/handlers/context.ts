import { Server, Socket } from 'socket.io';
import { GameRoom } from 'common';
/**
 * Shared context handed to each domain handler module. Each module registers its
 * own socket handlers on the connection, keeping the entrypoint thin.
 */
export interface HandlerContext {
  io: Server;
  socket: Socket;
}

/**
 * Reject a gameplay action once the game is over, or when the caller has been
 * knocked out (they keep spectating but get no more turns). Every action
 * handler calls this right after its room lookup so a finished room never
 * mutates state and a knocked-out player can never act (stale clients can
 * still emit). Returns true when the action was blocked.
 */
export function blockIfCannotAct(room: GameRoom, socket: Socket): boolean {
  if (room.gameStatus === 'finished') {
    socket.emit('error', { message: 'The game is over' });
    return true;
  }
  if (room.players.find((p) => p.id === socket.id)?.eliminated) {
    socket.emit('error', { message: 'You have been knocked out — you can only spectate' });
    return true;
  }
  return false;
}
