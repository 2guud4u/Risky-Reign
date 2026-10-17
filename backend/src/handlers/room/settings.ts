import {
  applyBonuses,
  MIN_PLAYERS,
  validateLayouts,
  generateBoard,
  HexLayout,
  DockSpec,
  GAME_HEX_SIZE,
  TurnMode,
  CHAT_MESSAGE_MAX,
  MAX_SETUP_CITIES,
  MIN_TURN_TIMER_S,
  MAX_TURN_TIMER_S,
  CHAT_LOG_MAX,
  PASSWORD_MAX,
  shuffle,
} from 'common';
import { createBoard, gameRooms, resetRoom } from '../../store';
// passKnockedOutTurn removed: leaveGame now keeps the seat like disconnect.
import { DEV_PRESET, applyDevPreset } from '../../devPreset';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, requireRoom } from '../context';
import { clearResumeLobbyHash, transition } from '../../lifecycle';
import { remove as removePersisted } from '../../persistence/gameRepository';
import { hashPassword } from '../../persistence/passwords';

const PORT_TYPES: ReadonlySet<string> = new Set([
  'generic',
  'Wood',
  'Brick',
  'Sheep',
  'Wheat',
  'Ore',
]);

/**
 * Coerce the wire payload into DockSpec[] or undefined. Invalid entries are
 * dropped (a bad dock never blocks a board save); an entirely malformed
 * payload falls back to a random coast.
 */
function sanitizeDocks(input: unknown): DockSpec[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: DockSpec[] = [];
  for (const d of input) {
    if (!d || typeof d !== 'object') continue;
    const { port, coast } = d as Partial<DockSpec>;
    if (typeof port !== 'string' || !PORT_TYPES.has(port)) continue;
    if (!Array.isArray(coast) || coast.length === 0 || coast.length > 2) continue;
    const indices = coast.filter((i) => Number.isInteger(i) && (i as number) >= 0) as number[];
    if (indices.length === 0) continue;
    out.push({ port: port as DockSpec['port'], coast: indices });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Room configuration and game lifecycle the host controls while waiting:
 * map regeneration, board editing, the points/turn-mode/setup-cities/timer
 * settings, in-room chat, starting and resetting the game. (Player color
 * and name live in seats.ts — they are seat edits, not room settings.)
 */
export function registerRoomSettingsHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // Rule/board edits go through Customize Game, gated by the room's
  // customization lock: unlocked (default) lets any seated player change
  // them; locked keeps them host-only. Password/start/reset stay host-only.
  const canCustomize = (room: { players: { id: string }[]; rulesLocked: boolean }): boolean =>
    !room.rulesLocked || room.players[0]?.id === socket.id;
  const rejectIfLockedOut = (room: { players: { id: string }[]; rulesLocked: boolean }): boolean => {
    if (canCustomize(room)) return false;
    socket.emit('error', { message: 'The host locked game customization' });
    return true;
  };
  socket.on('refreshMap', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = requireRoom(socket, roomId);
    if (!room) return;
    // Customization-gated: anyone may regenerate when the room is unlocked —
    // before the game starts. Mid-game this would wipe every settlement,
    // road, and soldier.
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'The game has already started' });
      return;
    }
    if (!room.players.some((p) => p.id === socket.id)) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }
    if (rejectIfLockedOut(room)) return;
    // Regenerate the game board.
    room.board = createBoard();
    // The new board resets the robber to the desert; drop any pending move.
    room.robberMove = null;
    applyBonuses(room);
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Update the "points to win" setting (only while waiting).
  socket.on('updatePointsToWin', (data: { roomId: string; pointsToWin: number }) => {
    const { roomId, pointsToWin } = data;
    const room = requireRoom(socket, roomId);
    if (!room) return;
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    if (rejectIfLockedOut(room)) return;
    const value = Math.floor(pointsToWin);
    if (!Number.isFinite(value) || value < 1) {
      socket.emit('error', { message: 'Points to win must be at least 1' });
      return;
    }
    room.pointsToWin = value;
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Room password: the privacy switch. Host only, while waiting — like every
  // other room setting. Set ⇒ the room leaves the Quick Play pool and joins/
  // spectates need it; empty ⇒ open again (the room re-enters the pool).
  socket.on('setRoomPassword', (data: { roomId: string; password: string }) => {
    const room = requireRoom(socket, data?.roomId);
    if (!room) return;
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    if (room.players[0]?.id !== socket.id) {
      socket.emit('error', { message: 'Only the host can change settings' });
      return;
    }
    const pw = typeof data.password === 'string' ? data.password : '';
    if (pw.length > PASSWORD_MAX) {
      socket.emit('error', { message: `Passwords are at most ${PASSWORD_MAX} characters` });
      return;
    }
    room.passwordHash = pw ? hashPassword(pw) : null;
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Set the turn structure (Build/Action scope per round, plus the optional
  // second roll after an 'around' Build). Customization-gated, while waiting.
  socket.on('setTurnMode', (data: { roomId: string; turnMode: TurnMode }) => {
    const { roomId, turnMode } = data;
    const room = requireRoom(socket, roomId);
    if (!room) return;
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    if (rejectIfLockedOut(room)) return;
    const ok =
      (turnMode?.build === 'single' || turnMode?.build === 'around') &&
      (turnMode?.action === 'single' || turnMode?.action === 'around') &&
      typeof turnMode.secondRoll === 'boolean';
    if (!ok) {
      socket.emit('error', { message: 'Invalid turn mode' });
      return;
    }
    // A second roll only exists after an 'around' Build phase.
    room.turnMode = {
      build: turnMode.build,
      action: turnMode.action,
      secondRoll: turnMode.build === 'around' && turnMode.secondRoll,
    };
    broadcastRoom(io, room, 'roomUpdate');
  });

  // How many setup placements may be cities (0..MAX_SETUP_CITIES).
  // Customization-gated, while waiting.
  socket.on('setSetupCities', (data: { roomId: string; setupCities: number }) => {
    const room = requireRoom(socket, data?.roomId);
    if (!room) return;
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    if (rejectIfLockedOut(room)) return;
    const value = data.setupCities;
    if (!Number.isInteger(value) || value < 0 || value > MAX_SETUP_CITIES) {
      socket.emit('error', { message: `Setup cities must be 0 to ${MAX_SETUP_CITIES}` });
      return;
    }
    room.setupCities = value;
    broadcastRoom(io, room, 'roomUpdate');
  });
  // Per-phase turn timer (0 = off). Customization-gated, while waiting.
  // Value arrives in ms; whole seconds only.
  socket.on('setTurnTimer', (data: { roomId: string; turnTimerMs: number }) => {
    const room = requireRoom(socket, data?.roomId);
    if (!room) return;
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    if (rejectIfLockedOut(room)) return;
    const ms = data.turnTimerMs;
    const valid =
      Number.isInteger(ms) &&
      (ms === 0 || (ms >= MIN_TURN_TIMER_S * 1000 && ms <= MAX_TURN_TIMER_S * 1000));
    if (!valid) {
      socket.emit('error', {
        message: `Turn timer must be off or ${MIN_TURN_TIMER_S}-${MAX_TURN_TIMER_S} seconds`,
      });
      return;
    }
    room.turnTimerMs = ms;
    broadcastRoom(io, room, 'roomUpdate');
  });

  // In-room chat. Seated players send as their name; spectators as
  // 'Spectator'. The log rides the broadcast room state, so late joiners and
  // reloads get history for free.
  socket.on('sendChat', (data: { roomId: string; text: string; to?: string }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room) return;
    const seated = room.players.find((p) => p.id === socket.id);
    const watching = room.spectators.includes(socket.id);
    if (!seated && !watching) return;
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) return;
    const from = seated?.name.trim() || (seated ? 'Unnamed' : 'Spectator');
    // Whisper: `to` must name a real seat (only seated players can be
    // addressed, and only seated players may whisper — a spectator has no
    // name the log could keep private). Anything else falls back to world.
    let to: string | undefined;
    if (seated && typeof data.to === 'string' && data.to) {
      const target = room.players.find((p) => p.name === data.to);
      if (!target) {
        socket.emit('error', { message: 'No player with that name' });
        return;
      }
      to = target.name;
    }
    room.chatLog.push({ from, text: text.slice(0, CHAT_MESSAGE_MAX), at: Date.now(), ...(to ? { to } : {}) });
    if (room.chatLog.length > CHAT_LOG_MAX) room.chatLog.splice(0, room.chatLog.length - CHAT_LOG_MAX);
    broadcastRoom(io, room, room.gameStatus === 'waiting' ? 'roomUpdate' : 'gameUpdate');
  });

  socket.on('editBoard', (data: { roomId: string; layouts: HexLayout[]; docks?: DockSpec[] }) => {
    const { roomId, layouts } = data;
    const room = requireRoom(socket, roomId);
    if (!room) return;
    const ok = validateLayouts(layouts);
    if (!ok.allowed) {
      socket.emit('error', { message: ok.reason ?? 'Invalid board layout' });
      return;
    }
    // Customization-gated: anyone may replace the board when the room is
    // unlocked — only before the game starts.
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'The game has already started' });
      return;
    }
    if (!room.players.some((p) => p.id === socket.id)) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }
    if (rejectIfLockedOut(room)) return;
    // Rebuild the board from the custom layout. Pre-game (waiting) this is
    // safe — nothing is built yet. The robber resets to the new desert.
    // Explicit docks (indices into the coast ring) persist the editor's
    // hand-placed harbors; absent = a fresh shuffled coast.
    room.board = generateBoard(layouts, {
      generator: 'custom',
      hexSize: GAME_HEX_SIZE,
      docks: sanitizeDocks(data.docks),
    });
    room.robberMove = null;
    applyBonuses(room);
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Customization lock (who may change rules/board while waiting). Host-only
  // toggle — unlike the settings it gates, this one is never delegated.
  socket.on('setRulesLock', (data: { roomId: string; locked: boolean }) => {
    const room = requireRoom(socket, data?.roomId);
    if (!room) return;
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change the lock while waiting' });
      return;
    }
    if (room.players[0]?.id !== socket.id) {
      socket.emit('error', { message: 'Only the host can change the lock' });
      return;
    }
    room.rulesLocked = typeof data.locked === 'boolean' ? data.locked : false;
    broadcastRoom(io, room, 'roomUpdate');
  });

  socket.on('startGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = requireRoom(socket, roomId);
    if (!room) return;
    // Restart is forbidden: only the host may start, from 'waiting' (fresh
    // game) or 'resuming' (a reopened paused game whose seats are all back).
    if (room.gameStatus !== 'waiting' && room.gameStatus !== 'resuming') {
      socket.emit('error', { message: 'The game has already started' });
      return;
    }
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.gameStatus === 'resuming') {
      // Every original seat must be claimed before the game continues —
      // nobody starts playing on behalf of a player who isn't back yet.
      if (!room.players.every((p) => p.connected)) {
        socket.emit('error', { message: 'Waiting for everyone to rejoin' });
        return;
      }
      transition(room, 'playing');
      applyBonuses(room);
      broadcastRoom(io, room, 'gameUpdate');
      return;
    }
    if (room.players.length < MIN_PLAYERS) {
      socket.emit('error', { message: `Need at least ${MIN_PLAYERS} players to start` });
      return;
    }
    transition(room, 'playing');
    // A random seat takes the first turn — not the host/first joiner.
    room.turnState.playerOrder = shuffle(room.turnState.playerOrder);
    room.turnState.player = room.turnState.playerOrder[0] ?? room.players[0]?.name ?? '';
    // Dev mode: skip setup with a preset board (see devPreset.ts).
    if (DEV_PRESET) applyDevPreset(room);
    applyBonuses(room);
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Reset game.
  socket.on('resetGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = requireRoom(socket, roomId);
    if (!room) return;
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can reset the game' });
      return;
    }
    // "Play Again" returns the room to the lobby (waiting room). The
    // persisted row is finished business — delete it so the code's expiry
    // doesn't sweep a lobby that was never persisted anyway.
    removePersisted(roomId);
    clearResumeLobbyHash(roomId);
    resetRoom(room);
    room.gameStatus = 'waiting';
    room.pausedAt = null;
    applyBonuses(room);
    broadcastRoom(io, room);
  });
}
