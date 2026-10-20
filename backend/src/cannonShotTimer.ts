import { Server } from 'socket.io';
import {
  GameRoom,
  applyBonuses,
  applyRollCannonShot,
  applyRollWallShot,
  canRollCannonShot,
  canRollWallShot,
  owedDice,
  owedRollers,
  rollDie,
  CANNON_SHOT_REVEAL_MS,
  WALL_SHOT_ROLL_MS,
} from 'common';
import { broadcastRoom } from './broadcast';
import { getRoom } from './store';
import { armRoomTimer, armedRoomTimer, disarmRoomTimer } from './roomTimer';

/**
 * Cannon-shot timers:
 *  - A pending shot (a Single wall shot's breach die, or a ranged duel's
 *    cannon + victim dice) gives its rollers WALL_SHOT_ROLL_MS, then the
 *    server rolls every owed die for them. A disconnected roller is rolled
 *    for immediately rather than burning the clock while the board waits.
 *  - Once every die is in (or the shot needs no dice, like an Explosive
 *    shot) the record lingers CANNON_SHOT_REVEAL_MS so every client can
 *    show the panel, then clears.
 * A timer is armed per (shot, step) so a pending shot's deadline never fires
 * into its own reveal. Handles are runtime-only, keyed per room in
 * roomTimer, synced off the broadcast funnel.
 */

type Step = 'pending' | 'reveal';

const stepOf = (shot: NonNullable<GameRoom['cannonShot']>): Step => {
  if (shot.kind === 'wall') return !shot.explosive && shot.roll === null ? 'pending' : 'reveal';
  return shot.cannonRoll === null || shot.victims.some((v) => v.roll === null) ? 'pending' : 'reveal';
};

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
    // An absent roller is rolled for right away — the frozen board must
    // never wait on a seat that isn't there. Wall shots owe one die (the
    // shooter's); duel shots can owe dice to several players at once.
    const rollers =
      shot.kind === 'wall'
        ? [shot.shooterName]
        : [...owedRollers(shot)];
    const absent = rollers.some(
      (name) => !room.players.find((p) => p.name === name)?.connected
    );
    if (absent) {
      disarmRoomTimer(room.id, 'cannonShot');
      rollOwedDice(io, room);
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
  if (stepOf(room.cannonShot) === 'pending') rollOwedDice(io, room);
}

/** Roll every owed die on a pending shot through the same check+apply path. */
function rollOwedDice(io: Server, room: GameRoom): void {
  const shot = room.cannonShot;
  if (!shot) return;
  if (shot.kind === 'wall') {
    const shooter = room.players.find((p) => p.name === shot.shooterName);
    if (shooter && canRollWallShot(room, shooter).allowed) applyRollWallShot(room, shooter, rollDie());
  } else {
    // One die at a time through the shared check: the cannon's die for the
    // shooter, each victim die for its owner.
    const rolls = [...owedRollers(shot)].flatMap((name) => {
      const player = room.players.find((p) => p.name === name);
      if (!player) return [];
      return owedDice(shot, name).map((soldierId) => ({ player, soldierId }));
    });
    for (const { player, soldierId } of rolls) {
      if (canRollCannonShot(room, player, soldierId).allowed) {
        applyRollCannonShot(room, player, soldierId, rollDie());
      }
    }
  }
  applyBonuses(room);
  broadcastRoom(io, room);
}
