import { Server } from 'socket.io';
import { GameRoom, applyBonuses, canRollWallGate, applyRollWallGate, rollDie, WALL_GATE_REVEAL_MS } from 'common';
import { broadcastRoom } from './broadcast';
import { getRoom } from './store';

/**
 * Wall-gate timers, both phases:
 *  - Awaiting the owner's roll: the crosser's guess is in and the wall owner
 *    has WALL_GATE_ROLL_MS to roll; otherwise the server rolls for them. A
 *    disconnected owner resolves immediately — a held crossing must never
 *    wait on a seat that isn't there.
 *  - Reveal: once resolved (`gate.roll` set), the state lingers for
 *    WALL_GATE_REVEAL_MS so every client can show the outcome, then clears.
 * Mirrors phaseTimer.ts: handles are runtime-only, keyed per room, synced off
 * the broadcast funnel.
 */
export const WALL_GATE_ROLL_MS = 30_000;

/** Live timer handles and the gate object they were armed for (staleness guard). */
const timers = new Map<string, { handle: NodeJS.Timeout; gate: object }>();

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
  if (gate.roll !== null) {
    // Reveal phase: schedule the clear once per resolved gate.
    if (timers.get(room.id)?.gate === gate) return;
    disarm(room.id);
    const handle = setTimeout(() => onRevealEnd(io, room.id, gate), WALL_GATE_REVEAL_MS);
    handle.unref?.();
    timers.set(room.id, { handle, gate });
    return;
  }
  if (gate.guess === null) {
    disarm(room.id);
    return;
  }
  const owner = room.players.find((p) => p.name === gate.wallOwnerName);
  // An absent owner resolves right away rather than burning the clock.
  if (!owner || !owner.connected) {
    resolveWallGate(io, room);
    return;
  }
  // Already armed for this exact gate — leave it be.
  if (timers.get(room.id)?.gate === gate) return;
  disarm(room.id);
  const handle = setTimeout(() => onExpire(io, room.id, gate), WALL_GATE_ROLL_MS);
  // A timer must never keep the process alive.
  handle.unref?.();
  timers.set(room.id, { handle, gate });
}

function disarm(roomId: string): void {
  clearTimeout(timers.get(roomId)?.handle);
  timers.delete(roomId);
}

function onExpire(io: Server, roomId: string, gate: object): void {
  timers.delete(roomId);
  const room = getRoom(roomId);
  // Stale-proof: the gate must still be the one this timer armed for.
  if (!room || room.wallGate !== gate || room.wallGate.roll !== null || room.wallGate.guess === null) return;
  resolveWallGate(io, room);
}

function onRevealEnd(io: Server, roomId: string, gate: object): void {
  timers.delete(roomId);
  const room = getRoom(roomId);
  // Only clear the gate this timer armed — a new one may have opened since.
  if (!room || room.wallGate !== gate) return;
  room.wallGate = null;
  broadcastRoom(io, room);
}

/** Roll for the wall owner through the same check+apply path as rollWallGate. */
function resolveWallGate(io: Server, room: GameRoom): void {
  const owner = room.players.find((p) => p.name === room.wallGate?.wallOwnerName);
  if (!owner || !canRollWallGate(room, owner).allowed) return;
  applyRollWallGate(room, owner, rollDie());
  applyBonuses(room);
  broadcastRoom(io, room);
}
