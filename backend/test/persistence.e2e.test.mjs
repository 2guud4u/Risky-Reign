/**
 * End-to-end lifecycle test: real server process + real socket.io clients.
 * Covers the whole feature:
 *   pause → link shows paused screen → wrong host password rejected →
 *   reopen → lobby password gate → all seats claim → continue →
 *   server RESTART mid-game → clients' saved seat tokens re-attach.
 *
 * Run: node --test test/persistence.e2e.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { io as ioc } from 'socket.io-client';

const dir = mkdtempSync(join(tmpdir(), 'catan-e2e-'));
const PORT = 37654;
let server;
let seq = 0;

function startServer() {
  server = spawn('node', ['dist/index.js'], {
    env: { ...process.env, DATA_DIR: dir, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: 'pipe',
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (d) => console.error('[server]', String(d)));
  return waitPort(PORT);
}
function stopServer() {
  return new Promise((res) => {
    if (!server) return res();
    server.on('exit', res);
    server.kill('SIGTERM');
  });
}
function waitPort(port, tries = 100) {
  return new Promise((res, rej) => {
    const attempt = () => {
      const s = ioc(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false });
      s.on('connect', () => {
        s.close();
        res();
      });
      s.on('connect_error', () => {
        s.close();
        if (--tries <= 0) return rej(new Error('server never came up'));
        setTimeout(attempt, 50);
      });
    };
    attempt();
  });
}

function client(name) {
  const s = ioc(`http://127.0.0.1:${PORT}`, { transports: ['websocket'], reconnection: false });
  s.name = name;
  s.inbox = [];
  const capture = (ev) => (d) => s.inbox.push({ ev, d });
  for (const ev of ['joined', 'roomUpdate', 'gameUpdate', 'rejoinOptions', 'pausedGameInfo', 'error', 'gameExpired', 'resumeLobbyUnlocked']) {
    s.on(ev, capture(ev));
  }
  return s;
}
function connected(s) {
  return new Promise((res, rej) => {
    if (s.connected) return res();
    s.on('connect', res);
    s.on('connect_error', rej);
  });
}
/** Wait until a matching event lands in the inbox; returns its data. */
async function waitFor(s, ev, pred = () => true, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = s.inbox.find((m) => m.ev === ev && pred(m.d));
    if (hit) return hit.d;
    await new Promise((r) => setTimeout(r, 15));
  }
  const last = s.inbox.filter((m) => m.ev === ev).at(-1);
  throw new Error(`${s.name}: timed out waiting for ${ev} — got ${JSON.stringify(s.inbox.map((m) => m.ev))} last=${JSON.stringify(last?.d?.gameStatus ?? last?.d)}`);
}
// claimSeat rotates the token — the CURRENT seat token is the latest joined.
const tokenOf = (s) => [...s.inbox].reverse().find((m) => m.ev === 'joined')?.d.token;

let alice, bob, carol;
const ROOM = 'TESTE2';

test('full pause/resume/restart lifecycle over real sockets', async (t) => {
  await startServer();

  alice = client('alice');
  bob = client('bob');
  carol = client('carol'); // never joins — opens the link later
  await Promise.all([connected(alice), connected(bob), connected(carol)]);

  // alice creates, bob joins, game starts.
  alice.emit('joinRoom', { roomId: ROOM, playerName: 'alice' });
  await waitFor(alice, 'joined');
  bob.emit('joinRoom', { roomId: ROOM, playerName: 'bob' });
  await waitFor(bob, 'joined');
  alice.emit('startGame', { roomId: ROOM });
  await waitFor(alice, 'roomUpdate', (r) => r.gameStatus === 'playing');

  // ── pause ────────────────────────────────────────────────────────────
  alice.emit('pauseGame', { roomId: ROOM, hostPassword: 'hpw', lobbyPassword: 'lpw' });
  const info = await waitFor(bob, 'pausedGameInfo', (d) => d.status === 'paused');
  assert.equal(info.roomId, ROOM);
  assert.ok(info.expiresAt > Date.now());
  // The link now answers pausedGameInfo instead of a room.
  carol.emit('joinRoom', { roomId: ROOM, playerName: 'carol' });
  const carolInfo = await waitFor(carol, 'pausedGameInfo', (d) => d.status === 'paused');
  assert.equal(carolInfo.players.length, 2);
  assert.equal(carolInfo.requiresLobbyPassword, false);

  // ── reopen (wrong password rejected, right one opens the lobby) ───────
  carol.emit('openResumeLobby', { roomId: ROOM, hostPassword: 'nope' });
  await waitFor(carol, 'error', (e) => /wrong host password/i.test(e.message));
  carol.emit('openResumeLobby', { roomId: ROOM, hostPassword: 'hpw' });
  const resuming = await waitFor(carol, 'pausedGameInfo', (d) => d.status === 'resuming');
  assert.equal(resuming.requiresLobbyPassword, true);
  assert.deepEqual(resuming.players.map((p) => p.name).sort(), ['alice', 'bob']);

  // ── seat claims gated by the lobby password ───────────────────────────
  bob.emit('claimSeat', { roomId: ROOM, name: 'bob', lobbyPassword: 'bad' });
  await waitFor(bob, 'error', (e) => /wrong lobby password/i.test(e.message));
  bob.emit('claimSeat', { roomId: ROOM, name: 'bob', lobbyPassword: 'lpw' });
  await waitFor(bob, 'joined');

  // host seat claims too, then continues the game.
  alice.emit('claimSeat', { roomId: ROOM, name: 'alice', lobbyPassword: 'lpw' });
  await waitFor(alice, 'joined');
  alice.emit('startGame', { roomId: ROOM });
  await waitFor(alice, 'gameUpdate', (r) => r.gameStatus === 'playing');

  // Tokens rotate on claimSeat — capture the CURRENT seat tokens now.
  const aliceToken = tokenOf(alice);
  assert.ok(aliceToken);

  // ── server restart mid-game: tokens re-attach, state survives ─────────
  await stopServer();
  await startServer();

  const alice2 = client('alice2');
  await connected(alice2);
  alice2.emit('joinRoom', { roomId: ROOM, playerName: 'alice', token: aliceToken });
  const back = await waitFor(alice2, 'roomUpdate', (r) => r.gameStatus === 'playing');
  assert.equal(back.players.find((p) => p.name === 'alice').connected, true);
  assert.equal(back.players.length, 2);
});

before(() => {});
after(async () => {
  for (const s of [alice, bob, carol]) s?.close();
  await stopServer();
  rmSync(dir, { recursive: true, force: true });
});
