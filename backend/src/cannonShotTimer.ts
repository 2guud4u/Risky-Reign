import { Server } from 'socket.io';
import {
  GameRoom,
  applyBonuses,
  applyRollWallShot,
  canRollWallShot,
  rollDie,
  CANNON_SHOT_REVEAL_MS,
  WALL_SHOT_ROLL_MS,
} from 'common';
import { broadcastRoom } from './broadcast';
import { getRoom } from './store';
import { armRoomTimer, armedRoomTimer, disarmRoomTimer } from './roomTimer';

/**
 * Cannon-shot timers (GLOSSARY "Wall" breach):
 *  - A Single wall shot first sits pending (`roll: null`): the shooter owes
 *    the breach roll — WALL_SHOT_ROLL_MS, then the server rolls for them.
 *    A disconnected shooter is rolled for immediately rather than burning
 *    the clock while the whole board waits.
 *  - Once any shot is resolved (a duel, a rolled wall shot, or a guaranteed
 *    Explosive shot) the record lingers CANNON_SHOT_REVEAL_MS so every
 *    client can show the panel, then clears.
 * A timer is armed per (shot, step) so a pending shot's deadline never fires
 * into its own reveal. Handles are runtime-only, keyed per room in
 * roomTimer, synced off the broadcast funnel.
 */

type Step = 'pending' | 'reveal';

const stepOf = (shot: NonNullable<GameRoom['cannonShot']>): Step =>
  shot.kind === 'wall' && !shot.explosive && shot.roll === null ? 'pending' : 'reveal';

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
  const step = stepOf(shot);
  if (step === 'pending') {
    const seat = room.players.find((p) => p.name === shot.shooterName);
    // An absent shooter is rolled for right away — the frozen board must
    // never wait on a seat that isn't there.
    if (!seat || !seat.connected) {
      disarmRoomTimer(room.id, 'cannonShot');
      rollForShooter(io, room);
      return;
    }
  }
  const armed = armedRoomTimer(room.id, 'cannonShot') as { shot: object; step: Step } | undefined;
  if (armed?.shot === shot && armed.step === step) return;
  const delay = step === 'pending' ? WALL_SHOT_ROLL_MS : CANNON_SHOT_REVEAL_MS;
  armRoomTimer(room.id, 'cannonShot', delay, { shot, step }, () => onTimer(io, room.id, shot, step));
}

function onTimer(io: Server, roomId: string, shot: object, step: Step): void {
  const room = getRoom(roomId);
  // Stale-proof: still the shot (and step) this timer armed for.
  if (!room || room.cannonShot !== shot) return;
  if (step === 'reveal') {
    room.cannonShot = null;
    broadcastRoom(io, room);
    return;
  }
  if (stepOf(room.cannonShot) === 'pending') rollForShooter(io, room);
}

/** Roll the breach die for a silent shooter through the same check+apply path. */
function rollForShooter(io: Server, room: GameRoom): void {
  const shot = room.cannonShot;
  if (!shot || shot.kind !== 'wall') return;
  const shooter = room.players.find((p) => p.name === shot.shooterName);
  if (!shooter || !canRollWallShot(room, shooter).allowed) return;
  applyRollWallShot(room, shooter, rollDie());
  applyBonuses(room);
  broadcastRoom(io, room);
}
