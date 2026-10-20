import { Socket } from 'socket.io';

import { GameServer, GameSocket } from './handlers/context';
import { registerRoomHandlers } from './handlers/room';
import { registerDispatchHandlers } from './dispatch';

/**
 * Wrap every listener registered on this socket so a single malformed message
 * throws into `catch` — emitting an 'error' to that client — instead of
 * crashing the whole server process. Handlers stay plain `socket.on(...)`;
 * this intercepts `socket.on` once per connection and rebinds the callback.
 */
function makeSocketCrashSafe(socket: GameSocket): void {
  // The real .on, rebound to a loose (event: string) signature — the typed
  // socket only accepts known event names, but this wrapper must intercept all.
  const realOn = socket.on.bind(socket) as (event: string, listener: (...args: unknown[]) => void) => Socket;
  const guarded = (event: string, listener: (...args: unknown[]) => void): Socket =>
    realOn(event, (...args: unknown[]) => {
      try {
        listener(...args);
      } catch (err) {
        console.error(`[socket] handler '${event}' threw:`, err);
        socket.emit('error', { message: 'Invalid request' });
      }
    });
  socket.on = guarded as GameSocket['on'];
}

/**
 * Wire up the socket surface. Two seams:
 *  - `registerDispatchHandlers`: every gameplay action, one loop over the
 *    dispatch table (transport adapter — rules live in `actions/`).
 *  - `registerRoomHandlers`: room-lifecycle transport (join, spectate,
 *    pause/resume, disconnect) — these create/delete rooms and bind sockets,
 *    which is adapter work, not a game action.
 */
export function setupSocketHandlers(io: GameServer): void {
  // Presence: every connected client counts as "online" (no room needed).
  // Push the running total to ALL sockets on each change so lobby viewers
  // see it live. nsp._remove runs before 'disconnect' fires, so
  // io.sockets.sockets.size is already accurate in both handlers.
  const broadcastOnlineCount = () =>
    io.emit('onlineCount', { count: io.sockets.sockets.size });
  io.on('connection', (socket) => {
    makeSocketCrashSafe(socket);
    const ctx = { io, socket };
    registerRoomHandlers(ctx);
    registerDispatchHandlers(ctx);
    broadcastOnlineCount();
    socket.on('disconnect', broadcastOnlineCount);
  });
}
