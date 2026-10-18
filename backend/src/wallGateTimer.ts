import { Server } from 'socket.io';
import {
  GameRoom,
  applyBonuses,
  canRollWallGate,
  applyRollWallGate,
  canWallGuess,
  applyWallGuess,
  rollDie,
  WALL_GATE_REVEAL_MS,
} from 'common';
import { broadcastRoom } from './broadcast';
import { getRoom } from './store';

/**
 * Wall-gate timers (GLOSSARY "Wall gate": either side that doesn't act
 * within 30s has its number picked for it):
 *  - Awaiting the crosser's guess: WALL_GATE_ROLL_MS, then the server guesses.
 *  - Awaiting the owner's roll: WALL_GATE_ROLL_MS, then the server rolls.
 *  A disconnected seat is answered immediately — a held crossing must never
 *  wait on a seat that isn't there.
 *  - Reveal: once resolved (`gate.roll` set), the state lingers for
 *    WALL_GATE_REVEAL_MS so every client can show the outcome, then clears.
 * Mirrors phaseTimer.ts: handles are runtime-only, keyed per room, synced off
 * the broadcast funnel. A timer is armed per (gate, step) so the guess step's
 * timer never fires into the roll step.
 */
export const WALL_GATE_ROLL_MS = 30_000;

type Step = 'guess' | 'roll' | 'reveal';

/** Live timer handles and the gate/step they were armed for (staleness guard). */
const timers = new Map<string, { handle: NodeJS.Timeout; gate: object; step: Step }>();

/**
 * Reconcile the room's wall-gate timer with its current state. Runs at the
 * end of every `broadcastRoom` — the same single funnel as the phase timer.
 */
export function syncWallGateTimer(io: Server, room: GameRoom): void {
  const gate = room.wallGate;
  if (room.gameStatus !== 'playing' || !gate) {
    disarm(room.id);
    return;
  }
  const step: Step = gate.roll !== null ? 'reveal' : gate.guess === null ? 'guess' : 'roll';
  if (step !== 'reveal') {
    const seat = room.players.find((p) => p.name === (step === 'guess' ? gate.crosserName : gate.wallOwnerName));
    // An absent seat is answered right away rather than burning the clock.
    if (!seat || !seat.connected) {
      disarm(room.id);
      act(io, room, step);
      return;
    }
  }
  const armed = timers.get(room.id);
  if (armed?.gate === gate && armed.step === step) return;
  disarm(room.id);
  const delay = step === 'reveal' ? WALL_GATE_REVEAL_MS : WALL_GATE_ROLL_MS;
  const handle = setTimeout(() => onTimer(io, room.id, gate, step), delay);
  // A timer must never keep the process alive.
  handle.unref?.();
  timers.set(room.id, { handle, gate, step });
}

function disarm(roomId: string): void {
  clearTimeout(timers.get(roomId)?.handle);
  timers.delete(roomId);
}

function onTimer(io: Server, roomId: string, gate: object, step: Step): void {
  timers.delete(roomId);
  const room = getRoom(roomId);
  // Stale-proof: still the gate (and step) this timer armed for.
  if (!room || room.wallGate !== gate) return;
  if (step === 'reveal') {
    room.wallGate = null;
    broadcastRoom(io, room);
    return;
  }
  const current: Step = room.wallGate.roll !== null ? 'reveal' : room.wallGate.guess === null ? 'guess' : 'roll';
  if (current === step) act(io, room, step);
}

/** Answer for the silent side through the same check+apply path as its event. */
function act(io: Server, room: GameRoom, step: 'guess' | 'roll'): void {
  const gate = room.wallGate!;
  if (step === 'guess') {
    const crosser = room.players.find((p) => p.name === gate.crosserName);
    const guess = rollDie();
    if (!crosser || !canWallGuess(room, crosser, guess).allowed) return;
    applyWallGuess(room, crosser, guess);
  } else {
    const owner = room.players.find((p) => p.name === gate.wallOwnerName);
    if (!owner || !canRollWallGate(room, owner).allowed) return;
    applyRollWallGate(room, owner, rollDie());
  }
  applyBonuses(room);
  broadcastRoom(io, room);
}
