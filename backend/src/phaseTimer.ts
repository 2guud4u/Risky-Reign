import { Server } from 'socket.io';
import { GameRoom, applyBonuses } from 'common';
import { advanceTurn } from './turn';
import { broadcastRoom } from './broadcast';
import { gameRooms } from './store';

// Live setTimeout handles per room. Only the state on the room
// (`phaseTimerEndsAt` / `phaseTimerRemainingMs`) is broadcast; the handle is
// runtime-only (a deadline that passed while the server was down fires on
// the first sync after hydrate).
const timers = new Map<string, NodeJS.Timeout>();

/** A phase is timed while the game plays, no battle is open, and it's Build or Action. */
function isTimedPhase(room: GameRoom): boolean {
  return (
    room.gameStatus === 'playing' &&
    !room.battleState &&
    room.turnTimerMs > 0 &&
    (room.turnState.phase === 'Build' || room.turnState.phase === 'Action')
  );
}

/**
 * Reconcile the room's phase timer with its current state. Runs at the end
 * of every `broadcastRoom` — that single funnel catches every transition:
 * phase entry/exit (armed/disarmed), battle open (suspended: the remaining
 * ms are captured and the deadline cleared) and battle close (resumed:
 * a fresh deadline is set from the remaining ms).
 */
export function syncPhaseTimer(io: Server, room: GameRoom): void {
  const timed = isTimedPhase(room);
  if (!timed) {
    // Not in a timed window. A live battle keeps `phaseTimerRemainingMs` so
    // the clock resumes where it left off when the fight closes; everything
    // else (setup, dice, waiting, finished, timer turned off) resets clean.
    disarm(room);
    if (!room.battleState) room.phaseTimerRemainingMs = null;
    return;
  }
  if (room.phaseTimerEndsAt === null) {
    // Entering a timed phase — or the battle just closed: resume from the
    // suspended remainder when there is one, else start a fresh interval.
    const remaining = room.phaseTimerRemainingMs ?? room.turnTimerMs;
    room.phaseTimerRemainingMs = null;
    room.phaseTimerEndsAt = Date.now() + remaining;
  }
  arm(io, room);
}

/** Set (or reset) the deadline for the phase `advanceTurn` just entered. */
export function setPhaseDeadline(room: GameRoom): void {
  if (room.turnTimerMs > 0 && (room.turnState.phase === 'Build' || room.turnState.phase === 'Action')) {
    room.phaseTimerEndsAt = Date.now() + room.turnTimerMs;
    room.phaseTimerRemainingMs = null;
  } else {
    room.phaseTimerEndsAt = null;
    room.phaseTimerRemainingMs = null;
  }
}

function arm(io: Server, room: GameRoom): void {
  const delay = Math.max(0, (room.phaseTimerEndsAt ?? 0) - Date.now());
  clearTimeout(timers.get(room.id));
  // Stale-proof: the deadline is captured so a callback can't fire against a
  // newer timer the sync already armed (e.g. manual endTurn + timer race).
  const deadline = room.phaseTimerEndsAt;
  const handle = setTimeout(() => onExpire(io, room.id, deadline), delay);
  // A timer must never keep the process alive.
  handle.unref?.();
  timers.set(room.id, handle);
}

function disarm(room: GameRoom): void {
  // Battle open mid-timed-phase: freeze the clock, keep what's left.
  if (room.battleState && room.phaseTimerEndsAt !== null) {
    room.phaseTimerRemainingMs = Math.max(0, room.phaseTimerEndsAt - Date.now());
    room.phaseTimerEndsAt = null;
  } else {
    room.phaseTimerEndsAt = null;
  }
  clearTimeout(timers.get(room.id));
  timers.delete(room.id);
}

function onExpire(io: Server, roomId: string, deadline: number | null): void {
  timers.delete(roomId);
  const room = gameRooms.get(roomId);
  if (!room || deadline === null || room.phaseTimerEndsAt !== deadline) return;
  if (!isTimedPhase(room)) return;
  // Time ran out: skip the phase exactly as endTurn would. The robber-win
  // move requirement doesn't block auto-skip — that gate exists to stop a
  // player walking past their reward, not to hold the game hostage.
  advanceTurn(room);
  applyBonuses(room);
  broadcastRoom(io, room);
}
