import { Server } from 'socket.io';
import { GameRoom, CANNON_SHOT_REVEAL_MS } from 'common';
import { broadcastRoom } from './broadcast';
import { getRoom } from './store';

/**
 * Cannon-shot reveal timer: `room.cannonShot` is set the moment a
 * single-target shot resolves and lingers for CANNON_SHOT_REVEAL_MS so every
 * client can show the duel panel, then clears. Reveal-only — unlike the wall
 * gate there is no input owed, just the linger. Mirrors phaseTimer.ts:
 * handles are runtime-only, keyed per room, synced off the broadcast funnel.
 */

/** Live timer handles and the shot object they were armed for (staleness guard). */
const timers = new Map<string, { handle: NodeJS.Timeout; shot: object }>();

/**
 * Reconcile the room's cannon-shot timer with its current state. Runs at the
 * end of every `broadcastRoom` — the same single funnel as the phase timer.
 */
export function syncCannonShotTimer(io: Server, room: GameRoom): void {
  const shot = room.cannonShot;
  if (room.gameStatus !== 'playing' || !shot) {
    disarm(room.id);
    return;
  }
  // Already armed for this exact shot — leave it be.
  if (timers.get(room.id)?.shot === shot) return;
  disarm(room.id);
  const handle = setTimeout(() => onRevealEnd(io, room.id, shot), CANNON_SHOT_REVEAL_MS);
  // A timer must never keep the process alive.
  handle.unref?.();
  timers.set(room.id, { handle, shot });
}

function disarm(roomId: string): void {
  clearTimeout(timers.get(roomId)?.handle);
  timers.delete(roomId);
}

function onRevealEnd(io: Server, roomId: string, shot: object): void {
  timers.delete(roomId);
  const room = getRoom(roomId);
  // Only clear the shot this timer armed — a new one may have landed since.
  if (!room || room.cannonShot !== shot) return;
  room.cannonShot = null;
  broadcastRoom(io, room);
}
