import { HandlerContext } from '../context';
import { registerJoinHandlers } from './join';
import { registerSeatHandlers } from './seats';
import { registerRoomSettingsHandlers } from './settings';
import { registerPersistedGameHandlers } from './persist';

/**
 * Room-lifecycle handlers, split by concern:
 *  - join.ts      — joinRoom (create/attach/token re-attach/rejoin picker)
 *  - seats.ts     — claimSeat, spectate, color/name edits, leaveGame, disconnect
 *  - settings.ts  — host-controlled settings + start/reset/chat/board edits
 *  - persist.ts   — pause / resume-lobby open/close/unlock
 *  - shared.ts    — paused-info push, rejoin seats, name regex, password limiter
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
  registerRoomSettingsHandlers(ctx);
  registerPersistedGameHandlers(ctx, joinedRoomIds);
}
