/**
 * Persistence round-trip + expiry unit tests (no sockets). Run with:
 *   DATA_DIR=$(mktemp -d) node --test test/persistence.unit.test.mjs
 * (or just `npm test` — the file points DATA_DIR at a temp dir itself
 * before importing the repository).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// DATA_DIR must be set before the db module opens a connection.
const dir = mkdtempSync(join(tmpdir(), 'catan-test-'));
process.env.DATA_DIR = dir;

const repo = await import('../dist/persistence/gameRepository.js');
const store = await import('../dist/store.js');

function freshRoom(id) {
  const room = store.createGameRoom(id, 'alice');
  room.gameStatus = 'playing';
  // createGameRoom leaves seats to joinRoom — push one directly.
  room.players.push({
    id: '',
    name: 'alice',
    color: '#e11',
    token: 'seat-token-alice',
    resources: { Wood: 1, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 },
    victoryPoints: 2,
    eliminated: false,
    connected: false,
    developmentCards: [],
    freeRoadsLeft: 0,
    devCardsBoughtThisTurn: 0,
  });
  room.turnState.playerOrder = ['alice'];
  return room;
}
test('save → meta → load → expire → remove', () => {
  const room = freshRoom('UNIT01');
  assert.equal(repo.saveSnapshot(room, { status: 'playing', hostName: 'alice' }), true);

  const meta = repo.getMeta('UNIT01');
  assert.equal(meta.status, 'playing');
  assert.equal(meta.host_name, 'alice');
  assert.equal(meta.host_password_hash, null);
  assert.equal(meta.version, 1);

  const loaded = repo.load('UNIT01');
  assert.equal(loaded.id, 'UNIT01');
  assert.equal(loaded.players[0].name, 'alice');
  assert.equal(loaded.players[0].connected, false);
  assert.ok(loaded.players[0].token, 'seat token must survive for rejoin-after-restart');

  // Optimistic lock: stale version rejected, fresh one accepted.
  assert.equal(
    repo.saveSnapshot(room, { status: 'playing', hostName: 'alice' }, meta.version + 99),
    false
  );
  assert.equal(
    repo.saveSnapshot(room, { status: 'playing', hostName: 'alice' }, meta.version),
    true
  );

  // Autosave preserves columns it doesn't set.
  repo.saveSnapshot(room, { status: 'playing', hostName: 'alice' });
  const meta2 = repo.getMeta('UNIT01');
  assert.equal(meta2.host_password_hash, null);
  assert.ok(meta2.version > meta.version);

  // Expiry sweep removes rows past their activity window.
  const removed = repo.deleteExpired(Date.now() + 8 * 24 * 3600 * 1000);
  assert.deepEqual(removed, ['UNIT01']);
  assert.equal(repo.load('UNIT01'), null);
  // Second sweep is a no-op.
  assert.deepEqual(repo.deleteExpired(Date.now() + 8 * 24 * 3600 * 1000), []);
});

test('pause fields persist; lobby hash survives reopen/close', () => {
  const room = freshRoom('UNIT02');
  repo.saveSnapshot(room, {
    status: 'paused',
    hostName: 'alice',
    hostPasswordHash: 'scrypt:aa:bb',
    lobbyPasswordHash: 'scrypt:cc:dd',
    pausedAt: 1234,
  });
  const paused = repo.getMeta('UNIT02');
  assert.equal(paused.host_password_hash, 'scrypt:aa:bb');
  assert.equal(paused.lobby_password_hash, 'scrypt:cc:dd');
  assert.equal(paused.paused_at, 1234);

  // Reopen → resuming keeps both hashes; autosave doesn't wipe them.
  repo.updateStatus('UNIT02', 'resuming', paused.version);
  repo.saveSnapshot(room, { status: 'resuming', hostName: 'alice' });
  const resuming = repo.getMeta('UNIT02');
  assert.equal(resuming.host_password_hash, 'scrypt:aa:bb');
  assert.equal(resuming.lobby_password_hash, 'scrypt:cc:dd');

  // Close → paused again; lobby password column preserved for the next open.
  repo.updateStatus('UNIT02', 'paused', resuming.version);
  const repaused = repo.getMeta('UNIT02');
  assert.equal(repaused.lobby_password_hash, 'scrypt:cc:dd');
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});
