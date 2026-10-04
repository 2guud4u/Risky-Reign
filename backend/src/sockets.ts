import { Socket } from 'socket.io';

import { GameServer, GameSocket } from './handlers/context';
import { registerRoomHandlers } from './handlers/room';
import { registerDevCardHandlers } from './handlers/devCards';
import { registerTurnHandlers } from './handlers/turn';
import { registerBuildHandlers } from './handlers/build';
import { registerSoldierHandlers } from './handlers/soldier';
import { registerBattleHandlers } from './handlers/battle';
import { registerTradeHandlers } from './handlers/trade';

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
 * Wire up all socket handlers. Each domain module registers its own handlers on
 * the socket, keeping this entrypoint thin and the per-connection setup explicit.
 */
export function setupSocketHandlers(io: GameServer): void {
  io.on('connection', (socket) => {
    makeSocketCrashSafe(socket);
    const ctx = { io, socket };
    registerRoomHandlers(ctx);
    registerDevCardHandlers(ctx);
    registerTurnHandlers(ctx);
    registerBuildHandlers(ctx);
    registerSoldierHandlers(ctx);
    registerBattleHandlers(ctx);
    registerTradeHandlers(ctx);
  });
}
