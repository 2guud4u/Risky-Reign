import { HandlerContext } from '../context';
import { registerJoinHandlers } from './join';
import { registerSeatHandlers } from './seats';
import { registerPersistedGameHandlers } from './persist';

/**
 * Room-lifecycle handlers, split by concern:
 *  - join.ts      — joinRoom (create/attach/token re-attach/rejoin picker)
 *  - seats.ts     — claimSeat, spectate, leaveGame, disconnect
 *  - persist.ts   — pause / resume-lobby open/close/unlock
 *  - shared.ts    — paused-info push, rejoin seats, name regex, password limiter
 *
 * Lobby settings, seat color/name edits, start/reset, and chat are gameplay
 * actions now — see actions/room.ts via the dispatch table.
 *
 * `joinedRoomIds` is created here so join/seats/persist all record into the
 * same set the disconnect handler sweeps.
 */
export function registerRoomHandlers(ctx: HandlerContext): void {
  // Every room this socket joined (as a seat or a spectator): on disconnect
  // the seat is marked offline and the socket dropped from spectators.
  const joinedRoomIds = new Set<string>();
  registerJoinHandlers(ctx, joinedRoomIds);
  registerSeatHandlers(ctx, joinedRoomIds);
  registerPersistedGameHandlers(ctx, joinedRoomIds);
}
