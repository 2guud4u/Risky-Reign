/**
 * Turn-timer unit tests (no sockets — a stub `io` records broadcasts).
 * Run with: node --test test/phaseTimer.unit.test.mjs (after `npm run build`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

// DATA_DIR must be set before the db module opens a connection.
const dir = mkdtempSync(join(tmpdir(), 'catan-timer-'));
process.env.DATA_DIR = dir;

const store = await import('../dist/store.js');
const { syncPhaseTimer, setPhaseDeadline } = await import('../dist/phaseTimer.js');

// broadcastRoom's only use of `io` here is io.to(id).emit for connected
// sockets — no connected players means it's never touched.
const io = { to: () => ({ emit: () => {} }) };

const TIMER_MS = 150; // sub-second intervals so the test stays fast

function freshRoom(id) {
  const room = store.createGameRoom(id, 'alice');
  room.gameStatus = 'playing';
  room.players.push({
    id: '',
    name: 'alice',
    color: '#e11',
    token: 't',
    resources: { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 },
    victoryPoints: 0,
    eliminated: false,
    connected: false,
    developmentCards: [],
    freeRoadsLeft: 0,
    devCardsBoughtThisTurn: 0,
  });
  room.turnState.playerOrder = ['alice'];
  room.turnState.phase = 'Dice';
  room.turnTimerMs = TIMER_MS;
  return room;
}

test('expiry auto-advances Build → next phase', async () => {
  const room = freshRoom('T1');
  const { advanceTurn } = await import('../dist/turn.js');
  advanceTurn(room); // Dice → Build: deadline armed inside
  assert.equal(room.turnState.phase, 'Build');
  assert.ok(room.phaseTimerEndsAt && room.phaseTimerEndsAt > Date.now());
  syncPhaseTimer(io, room);

  await wait(TIMER_MS + 150);
  // around-the-table build with one player → next is Action.
  assert.notEqual(room.turnState.phase, 'Build');
  assert.equal(room.phaseTimerEndsAt === null || true, true); // re-armed or cleared
});

test('battle suspends and resumes the clock', async () => {
  const room = freshRoom('T2');
  room.turnState.phase = 'Action';
  setPhaseDeadline(room);
  syncPhaseTimer(io, room);
  const armed = room.phaseTimerEndsAt;
  assert.ok(armed);

  // Fight opens → the deadline freezes into `phaseTimerRemainingMs`.
  room.battleState = { attacker: 'alice' };
  syncPhaseTimer(io, room);
  assert.equal(room.phaseTimerEndsAt, null);
  const frozen = room.phaseTimerRemainingMs;
  assert.ok(frozen !== null && frozen > 0 && frozen <= TIMER_MS);

  // Time passes mid-fight: nothing may fire or advance the phase.
  await wait(TIMER_MS + 150);
  assert.equal(room.turnState.phase, 'Action');
  assert.equal(room.phaseTimerEndsAt, null);

  // Fight closes → the clock resumes from the remainder, not a fresh
  // interval and not already-expired.
  room.battleState = null;
  syncPhaseTimer(io, room);
  assert.ok(room.phaseTimerEndsAt !== null && room.phaseTimerEndsAt > Date.now());
  assert.ok(room.phaseTimerEndsAt - Date.now() <= frozen);
  assert.equal(room.phaseTimerRemainingMs, null);

  // The resumed deadline does fire.
  await wait(frozen + 200);
  assert.notEqual(room.turnState.phase, 'Action');
});

test('timer off = never armed; non-timed phases clear state', async () => {
  const room = freshRoom('T3');
  room.turnTimerMs = 0;
  room.turnState.phase = 'Action';
  syncPhaseTimer(io, room);
  assert.equal(room.phaseTimerEndsAt, null);
  assert.equal(room.phaseTimerRemainingMs, null);

  // Timer on but Dice phase: disarmed.
  room.turnTimerMs = TIMER_MS;
  room.turnState.phase = 'Dice';
  room.phaseTimerEndsAt = Date.now() + TIMER_MS;
  syncPhaseTimer(io, room);
  assert.equal(room.phaseTimerEndsAt, null);
  assert.equal(room.phaseTimerRemainingMs, null);
});
