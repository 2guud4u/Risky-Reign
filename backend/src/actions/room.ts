/**
 * Room actions: lobby settings and seat edits that used to live in
 * handlers/room. Rule/board edits are customization-gated (any seated player
 * while unlocked, host-only while locked); password, the lock toggle,
 * start, and reset stay host-only. sendChat is the one open action —
 * spectators chat too.
 */
import {
  CHAT_LOG_MAX,
  CHAT_MESSAGE_MAX,
  DockSpec,
  GAME_HEX_SIZE,
  GameRoom,
  generateBoard,
  HexLayout,
  MAX_SETUP_CITIES,
  MAX_TURN_TIMER_S,
  MIN_PLAYERS,
  MIN_TURN_TIMER_S,
  normalizeColor,
  PASSWORD_MAX,
  Player,
  PLAYER_NAME_MAX,
  playerColorError,
  shuffle,
  TurnMode,
  validateLayouts,
} from 'common';
import { createBoard, resetRoom } from '../store';
import { DEV_PRESET, applyDevPreset } from '../devPreset';
import { transition } from '../lifecycle';
import { hashPassword } from '../persistence/passwords';
import { PLAYER_NAME_RE } from '../handlers/room/shared';
import type { ActionEntry, ActionResult } from '../dispatch';

const PORT_TYPES: Record<string, true> = {
  generic: true,
  Wood: true,
  Brick: true,
  Sheep: true,
  Wheat: true,
  Ore: true,
};

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
    if (typeof port !== 'string' || !PORT_TYPES[port]) continue;
    if (!Array.isArray(coast) || coast.length === 0 || coast.length > 2) continue;
    const indices = coast.filter((i) => Number.isInteger(i) && (i as number) >= 0) as number[];
    if (indices.length === 0) continue;
    out.push({ port: port as DockSpec['port'], coast: indices });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Rule/board edits go through Customize Game, gated by the room's
 * customization lock: unlocked (default) lets any seated player change
 * them; locked keeps them host-only. Password/start/reset stay host-only.
 */
function canCustomize(
  room: { players: { id: string }[]; rulesLocked: boolean },
  socketId: string
): boolean {
  return !room.rulesLocked || room.players[0]?.id === socketId;
}

/** The lock error, or null when the caller may customize. */
function rejectIfLockedOut(
  room: { players: { id: string }[]; rulesLocked: boolean },
  socketId: string
): string | null {
  if (canCustomize(room, socketId)) return null;
  return 'The host locked game customization';
}

const SILENT: ActionResult = { broadcast: false };

export const ROOM_ACTIONS: Record<string, ActionEntry> = {
  refreshMap: {
    run: (room: GameRoom, _player: Player, _payload: { roomId: string }, socketId: string) => {
      // Customization-gated: anyone may regenerate when the room is unlocked —
      // before the game starts. Mid-game this would wipe every settlement,
      // road, and soldier.
      if (room.gameStatus !== 'waiting') return { error: 'The game has already started' };
      const locked = rejectIfLockedOut(room, socketId);
      if (locked) return { error: locked };
      // Regenerate the game board.
      room.board = createBoard();
      // The new board resets the robber to the desert; drop any pending move.
      room.robberMove = null;
      return { broadcast: 'roomUpdate' };
    },
  },

  updatePointsToWin: {
    run: (
      room: GameRoom,
      _player: Player,
      { pointsToWin }: { roomId: string; pointsToWin: number },
      socketId: string
    ) => {
      if (room.gameStatus !== 'waiting') {
        return { error: 'Can only change settings while waiting' };
      }
      const locked = rejectIfLockedOut(room, socketId);
      if (locked) return { error: locked };
      const value = Math.floor(pointsToWin);
      if (!Number.isFinite(value) || value < 1) {
        return { error: 'Points to win must be at least 1' };
      }
      room.pointsToWin = value;
      return { broadcast: 'roomUpdate' };
    },
  },

  // Room password: the privacy switch. Host only, while waiting — like every
  // other room setting. Set ⇒ the room leaves the Quick Play pool and joins/
  // spectates need it; empty ⇒ open again (the room re-enters the pool).
  setRoomPassword: {
    run: (
      room: GameRoom,
      _player: Player,
      { password }: { roomId: string; password: string },
      socketId: string
    ) => {
      if (room.gameStatus !== 'waiting') {
        return { error: 'Can only change settings while waiting' };
      }
      if (room.players[0]?.id !== socketId) {
        return { error: 'Only the host can change settings' };
      }
      const pw = typeof password === 'string' ? password : '';
      if (pw.length > PASSWORD_MAX) {
        return { error: `Passwords are at most ${PASSWORD_MAX} characters` };
      }
      room.passwordHash = pw ? hashPassword(pw) : null;
      return { broadcast: 'roomUpdate' };
    },
  },

  // Set the turn structure (Build/Action scope per round, plus the optional
  // second roll after an 'around' Build). Customization-gated, while waiting.
  setTurnMode: {
    run: (
      room: GameRoom,
      _player: Player,
      { turnMode }: { roomId: string; turnMode: TurnMode },
      socketId: string
    ) => {
      if (room.gameStatus !== 'waiting') {
        return { error: 'Can only change settings while waiting' };
      }
      const locked = rejectIfLockedOut(room, socketId);
      if (locked) return { error: locked };
      const ok =
        (turnMode?.build === 'single' || turnMode?.build === 'around') &&
        (turnMode?.action === 'single' || turnMode?.action === 'around') &&
        typeof turnMode.secondRoll === 'boolean';
      if (!ok) return { error: 'Invalid turn mode' };
      // A second roll only exists after an 'around' Build phase.
      room.turnMode = {
        build: turnMode.build,
        action: turnMode.action,
        secondRoll: turnMode.build === 'around' && turnMode.secondRoll,
      };
      return { broadcast: 'roomUpdate' };
    },
  },

  // How many setup placements may be cities (0..MAX_SETUP_CITIES).
  // Customization-gated, while waiting.
  setSetupCities: {
    run: (
      room: GameRoom,
      _player: Player,
      { setupCities }: { roomId: string; setupCities: number },
      socketId: string
    ) => {
      if (room.gameStatus !== 'waiting') {
        return { error: 'Can only change settings while waiting' };
      }
      const locked = rejectIfLockedOut(room, socketId);
      if (locked) return { error: locked };
      if (!Number.isInteger(setupCities) || setupCities < 0 || setupCities > MAX_SETUP_CITIES) {
        return { error: `Setup cities must be 0 to ${MAX_SETUP_CITIES}` };
      }
      room.setupCities = setupCities;
      return { broadcast: 'roomUpdate' };
    },
  },

  // Per-phase turn timer (0 = off). Customization-gated, while waiting.
  // Value arrives in ms; whole seconds only.
  setTurnTimer: {
    run: (
      room: GameRoom,
      _player: Player,
      { turnTimerMs }: { roomId: string; turnTimerMs: number },
      socketId: string
    ) => {
      if (room.gameStatus !== 'waiting') {
        return { error: 'Can only change settings while waiting' };
      }
      const locked = rejectIfLockedOut(room, socketId);
      if (locked) return { error: locked };
      const valid =
        Number.isInteger(turnTimerMs) &&
        (turnTimerMs === 0 ||
          (turnTimerMs >= MIN_TURN_TIMER_S * 1000 && turnTimerMs <= MAX_TURN_TIMER_S * 1000));
      if (!valid) {
        return {
          error: `Turn timer must be off or ${MIN_TURN_TIMER_S}-${MAX_TURN_TIMER_S} seconds`,
        };
      }
      room.turnTimerMs = turnTimerMs;
      return { broadcast: 'roomUpdate' };
    },
  },

  editBoard: {
    run: (
      room: GameRoom,
      _player: Player,
      { layouts, docks }: { roomId: string; layouts: HexLayout[]; docks?: DockSpec[] },
      socketId: string
    ) => {
      const ok = validateLayouts(layouts);
      if (!ok.allowed) return { error: ok.reason ?? 'Invalid board layout' };
      // Customization-gated: anyone may replace the board when the room is
      // unlocked — only before the game starts.
      if (room.gameStatus !== 'waiting') return { error: 'The game has already started' };
      const locked = rejectIfLockedOut(room, socketId);
      if (locked) return { error: locked };
      // Rebuild the board from the custom layout. Pre-game (waiting) this is
      // safe — nothing is built yet. The robber resets to the new desert.
      // Explicit docks (indices into the coast ring) persist the editor's
      // hand-placed harbors; absent = a fresh shuffled coast.
      room.board = generateBoard(layouts, {
        generator: 'custom',
        hexSize: GAME_HEX_SIZE,
        docks: sanitizeDocks(docks),
      });
      room.robberMove = null;
      return { broadcast: 'roomUpdate' };
    },
  },

  // Customization lock (who may change rules/board while waiting). Host-only
  // toggle — unlike the settings it gates, this one is never delegated.
  setRulesLock: {
    run: (
      room: GameRoom,
      _player: Player,
      { locked }: { roomId: string; locked: boolean },
      socketId: string
    ) => {
      if (room.gameStatus !== 'waiting') {
        return { error: 'Can only change the lock while waiting' };
      }
      if (room.players[0]?.id !== socketId) {
        return { error: 'Only the host can change the lock' };
      }
      room.rulesLocked = typeof locked === 'boolean' ? locked : false;
      return { broadcast: 'roomUpdate' };
    },
  },

  startGame: {
    run: (room: GameRoom, _player: Player, _payload: { roomId: string }, socketId: string) => {
      // Restart is forbidden: only the host may start, from 'waiting' (fresh
      // game) or 'resuming' (a reopened paused game whose seats are all back).
      if (room.gameStatus !== 'waiting' && room.gameStatus !== 'resuming') {
        return { error: 'The game has already started' };
      }
      const isHost = room.players[0]?.id === socketId;
      if (!isHost) return { error: 'Only the host can start the game' };
      if (room.gameStatus === 'resuming') {
        // Every original seat must be claimed before the game continues —
        // nobody starts playing on behalf of a player who isn't back yet.
        if (!room.players.every((p) => p.connected)) {
          return { error: 'Waiting for everyone to rejoin' };
        }
        transition(room, 'playing');
        return { broadcast: 'gameUpdate' };
      }
      if (room.players.length < MIN_PLAYERS) {
        return { error: `Need at least ${MIN_PLAYERS} players to start` };
      }
      transition(room, 'playing');
      // A random seat takes the first turn — not the host/first joiner.
      room.turnState.playerOrder = shuffle(room.turnState.playerOrder);
      room.turnState.player = room.turnState.playerOrder[0] ?? room.players[0]?.name ?? '';
      // Dev mode: skip setup with a preset board (see devPreset.ts).
      if (DEV_PRESET) applyDevPreset(room);
      return { broadcast: 'roomUpdate' };
    },
  },

  // "Play Again" returns the room to the lobby (waiting room). The 'waiting'
  // transition deletes the persisted row (finished business — the code's
  // expiry shouldn't sweep a lobby that was never persisted anyway), clears
  // the resume-lobby hash, and nulls pausedAt. allowFinished: the emit comes
  // from the victory screen of a finished room.
  resetGame: {
    allowFinished: true,
    run: (room: GameRoom, _player: Player, _payload: { roomId: string }, socketId: string) => {
      const isHost = room.players[0]?.id === socketId;
      if (!isHost) return { error: 'Only the host can reset the game' };
      // A room already waiting resets idempotently (no transition edge);
      // 'resuming' can't reach here through the UI — if it does, transition
      // rejects the edge and the caller sees its error string.
      if (room.gameStatus !== 'waiting') {
        const err = transition(room, 'waiting');
        if (err) return { error: err };
      }
      resetRoom(room);
      return {};
    },
  },

  // In-room chat. Seated players send as their name; spectators as
  // 'Spectator'. The log rides the broadcast room state, so late joiners and
  // reloads get history for free. Open action: spectators chat too.
  sendChat: {
    allowFinished: true,
    open: (
      room: GameRoom,
      player: Player | undefined,
      data: { roomId: string; text: string; to?: string },
      socketId: string
    ) => {
      const watching = room.spectators.includes(socketId);
      if (!player && !watching) return SILENT;
      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!text) return SILENT;
      const from = player?.name.trim() || (player ? 'Unnamed' : 'Spectator');
      // Whisper: `to` must name a real seat (only seated players can be
      // addressed, and only seated players may whisper — a spectator has no
      // name the log could keep private). Anything else falls back to world.
      let to: string | undefined;
      if (player && typeof data.to === 'string' && data.to) {
        const target = room.players.find((p) => p.name === data.to);
        if (!target) return { error: 'No player with that name' };
        to = target.name;
      }
      room.chatLog.push({
        from,
        text: text.slice(0, CHAT_MESSAGE_MAX),
        at: Date.now(),
        ...(to ? { to } : {}),
      });
      if (room.chatLog.length > CHAT_LOG_MAX) {
        room.chatLog.splice(0, room.chatLog.length - CHAT_LOG_MAX);
      }
      return { broadcast: room.gameStatus === 'waiting' ? 'roomUpdate' : 'gameUpdate' };
    },
  },

  // Change your color while still in the lobby. In a 'resuming' lobby the
  // paused-info payload carries colors too, so it gets a refresh push.
  updatePlayerColor: {
    run: (room: GameRoom, player: Player, { color }: { roomId: string; color: string }) => {
      if (room.gameStatus !== 'waiting' && room.gameStatus !== 'resuming') return SILENT;
      const requested = typeof color === 'string' ? color : '';
      const others = room.players.filter((pl) => pl.id !== player.id).map((pl) => pl.color);
      const err = playerColorError(requested, others);
      if (err) return { error: err };
      player.color = normalizeColor(requested);
      return room.gameStatus === 'resuming'
        ? { broadcast: 'roomUpdate', effects: [{ kind: 'pausedInfo' }] }
        : { broadcast: 'roomUpdate' };
    },
  },

  // Set your name while still in the lobby (join is name-optional; the name
  // is chosen after joining).
  updatePlayerName: {
    run: (room: GameRoom, player: Player, { name }: { roomId: string; name: string }) => {
      // Names are the foreign key for soldiers, settlements and turn order —
      // mid-game (a resuming lobby counts) renaming stays forbidden.
      if (room.gameStatus !== 'waiting') return SILENT;
      const newName = typeof name === 'string' ? name.trim() : '';
      if (!newName || newName.length > PLAYER_NAME_MAX || !PLAYER_NAME_RE.test(newName)) {
        return { error: 'Invalid player name' };
      }
      if (room.players.some((pl) => pl.name.toLowerCase() === newName.toLowerCase())) {
        return { error: 'That name is taken' };
      }
      // Re-point the turn only if the renamed seat is the one holding it.
      // Comparing names is wrong: nameless seats all share "" (a player who
      // names first would otherwise steal the creator's first setup turn and,
      // via the setup snake order, get three turns in a row). Capture the turn
      // holder's seat from the OLD order before renaming, then match by index.
      const seatIndex = room.players.indexOf(player);
      const turnSeatIndex = room.turnState.playerOrder.indexOf(room.turnState.player);
      player.name = newName;
      room.turnState.playerOrder = room.players.map((pl) => pl.name);
      if (turnSeatIndex === seatIndex) room.turnState.player = newName;
      return { broadcast: 'roomUpdate' };
    },
  },
};
