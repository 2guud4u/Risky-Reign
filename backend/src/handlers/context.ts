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
 * Reject a gameplay action once the game is over. Every action handler
 * calls this right after its room lookup so a finished room never mutates
 * state (the UI switches to the victory screen, but stale clients can
 * still emit). Returns true when the action was blocked.
 */
export function blockIfFinished(room: GameRoom, socket: Socket): boolean {
  if (room.gameStatus === 'finished') {
    socket.emit('error', { message: 'The game is over' });
    return true;
  }
  return false;
}
