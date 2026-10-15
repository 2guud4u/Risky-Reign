/**
 * Quick Play eligibility + pick-order unit tests (no sockets). Exercises the
 * shared rule the server handler delegates to:
 *   node --test test/quickplay.unit.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { pickQuickPlayRoom, quickPlayEligible, TURN_MODE_PRESETS } = await import(
  '../../common/dist/index.js'
);
const store = await import('../dist/store.js');

const seat = (name) => ({
  id: `sock-${name}`,
  name,
  color: '#e11',
  token: `tok-${name}`,
  resources: { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 },
  victoryPoints: 0,
  eliminated: false,
  connected: true,
  developmentCards: [],
  freeRoadsLeft: 0,
  devCardsBoughtThisTurn: 0,
});

function openRoom(id, seats = 1) {
  const room = store.createGameRoom(id, 'host');
  room.players.push(...Array.from({ length: seats }, (_, i) => seat(`${id}-p${i}`)));
  return room;
}

test('a fresh waiting room with default settings is eligible', () => {
  assert.equal(quickPlayEligible(openRoom('R1')), true);
});

test('passworded, started, full, and custom-settings rooms are not', () => {
  const pw = openRoom('R2');
  pw.passwordHash = 'hash';
  assert.equal(quickPlayEligible(pw), false);

  const started = openRoom('R3');
  started.gameStatus = 'playing';
  assert.equal(quickPlayEligible(started), false);

  const custom = openRoom('R4');
  custom.pointsToWin = 12;
  assert.equal(quickPlayEligible(custom), false);

  const timer = openRoom('R5');
  timer.turnTimerMs = 30000;
  assert.equal(quickPlayEligible(timer), false);

  const mode = openRoom('R6');
  mode.turnMode = TURN_MODE_PRESETS.catan;
  assert.equal(quickPlayEligible(mode), false);

  const full = openRoom('R7', 10);
  assert.equal(quickPlayEligible(full), false);
});

test('pick prefers the fullest eligible lobby', () => {
  const rooms = new Map([
    ['A', openRoom('A', 1)],
    ['B', openRoom('B', 5)],
    ['C', openRoom('C', 3)],
  ]);
  assert.equal(pickQuickPlayRoom(rooms.values())?.id, 'B');
});

test('ties go to the earliest-inserted room', () => {
  const rooms = new Map([
    ['X', openRoom('X', 2)],
    ['Y', openRoom('Y', 2)],
  ]);
  assert.equal(pickQuickPlayRoom(rooms.values())?.id, 'X');
});

test('a passworded room never wins even when fullest', () => {
  const locked = openRoom('LOCKED', 8);
  locked.passwordHash = 'hash';
  const rooms = new Map([
    ['LOCKED', locked],
    ['OPEN', openRoom('OPEN', 1)],
  ]);
  assert.equal(pickQuickPlayRoom(rooms.values())?.id, 'OPEN');
});

test('no eligible room returns null (the create path)', () => {
  const rooms = new Map([['DONE', openRoom('DONE')]]);
  rooms.get('DONE').gameStatus = 'finished';
  assert.equal(pickQuickPlayRoom(rooms.values()), null);
});
