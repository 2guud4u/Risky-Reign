import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, GameRoom, ServerToClientEvents } from 'common';

/** Server/Socket bound to the shared event contract. */
export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Shared context handed to each domain handler module. Each module registers its
 * own socket handlers on the connection, keeping the entrypoint thin.
 */
export interface HandlerContext {
  io: GameServer;
  socket: GameSocket;
}

/**
 * Reject a gameplay action once the game is over, or when the caller has been
 * knocked out (they keep spectating but get no more turns). Every action
 * handler calls this right after its room lookup so a finished room never
 * mutates state and a knocked-out player can never act (stale clients can
 * still emit). Returns true when the action was blocked.
 */
export function blockIfCannotAct(room: GameRoom, socket: GameSocket): boolean {
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
