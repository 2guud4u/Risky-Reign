import { Server } from 'socket.io';
import { GameRoom, CANNON_SHOT_REVEAL_MS } from 'common';
import { broadcastRoom } from './broadcast';
import { getRoom } from './store';
import { armRoomTimer, armedRoomTimer, disarmRoomTimer } from './roomTimer';

/**
 * Cannon-shot reveal timer: `room.cannonShot` is set the moment a
 * single-target shot resolves and lingers for CANNON_SHOT_REVEAL_MS so every
 * client can show the duel panel, then clears. Reveal-only — unlike the wall
 * gate there is no input owed, just the linger. Handles are runtime-only,
 * keyed per room in roomTimer, synced off the broadcast funnel.
 */

/**
 * Reconcile the room's cannon-shot timer with its current state. Runs at the
 * end of every `broadcastRoom` — the same single funnel as the phase timer.
 */
export function syncCannonShotTimer(io: Server, room: GameRoom): void {
  const shot = room.cannonShot;
  if (room.gameStatus !== 'playing' || !shot) {
    disarmRoomTimer(room.id, 'cannonShot');
    return;
  }
  // Already armed for this exact shot — leave it be.
  if (armedRoomTimer(room.id, 'cannonShot') === shot) return;
  armRoomTimer(room.id, 'cannonShot', CANNON_SHOT_REVEAL_MS, shot, () =>
    onRevealEnd(io, room.id, shot)
  );
}

function onRevealEnd(io: Server, roomId: string, shot: object): void {
  const room = getRoom(roomId);
  // Only clear the shot this timer armed — a new one may have landed since.
  if (!room || room.cannonShot !== shot) return;
  room.cannonShot = null;
  broadcastRoom(io, room);
}
