import { GameRoom, RejoinSeat } from 'common';
import { getRoom } from '../../store';
import { GameServer } from '../context';
import { pausedInfo, persistedMeta } from '../../lifecycle';
import { createAttemptLimiter } from '../../persistence/passwords';

/**
 * Helpers shared by the room handler modules (join, seats, persist) and the
 * room actions table: the paused-game info push, the rejoin-picker seat
 * list, the player-name shape, and the password probe limiter.
 */

/** A lobby name is letters, digits, space, _ or - (length checked by callers). */
export const PLAYER_NAME_RE = /^[A-Za-z0-9 _-]+$/;

/** Host/lobby password probes per socket (brute-force guard). */
export const passwordAttempts = createAttemptLimiter(8, 60_000);

/** Push the current paused/resuming info to every socket on the room channel. */
export function broadcastPausedInfo(io: GameServer, roomId: string): void {
  const meta = persistedMeta(roomId);
  if (!meta || (meta.status !== 'paused' && meta.status !== 'resuming')) return;
  io.to(roomId).emit('pausedGameInfo', pausedInfo(roomId, meta, getRoom(roomId)));
}

/**
 * Seats in a started game whose player dropped out (no live socket): the
 * picks offered by the rejoin picker. Knocked-out seats are included — the
 * player may still want to come back and watch from their own seat.
 */
export function disconnectedSeats(room: GameRoom): RejoinSeat[] {
  return room.players.filter((p) => !p.connected).map((p) => ({ name: p.name, color: p.color }));
}
