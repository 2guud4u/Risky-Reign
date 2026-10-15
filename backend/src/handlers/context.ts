import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, GameRoom, Player, ServerToClientEvents } from 'common';
import { gameRooms } from '../store';

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

/**
 * Resolve the room for an action payload, emitting 'Room not found' and
 * returning null when the code is unknown. Replaces the repeated
 * `gameRooms.get` + error prelude at the head of nearly every handler.
 */
export function requireRoom(
  socket: GameSocket,
  roomId: string | undefined
): GameRoom | null {
  const room = gameRooms.get(roomId ?? '');
  if (!room) {
    socket.emit('error', { message: 'Room not found' });
    return null;
  }
  return room;
}

/**
 * Resolve the calling socket's seat in a room, emitting 'Player not found'
 * and returning null for spectators/unknown sockets.
 */
export function requirePlayer(room: GameRoom, socket: GameSocket): Player | null {
  const player = room.players.find((p) => p.id === socket.id);
  if (!player) {
    socket.emit('error', { message: 'Player not found' });
    return null;
  }
  return player;
}
