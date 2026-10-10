import { randomBytes } from 'crypto';
import {
  PLAYER_COLORS,
  isHexColor,
  normalizeColor,
  playerColorError,
  Player,
  applyBonuses,
  MAX_PLAYERS,
  MIN_PLAYERS,
  validateLayouts,
  generateBoard,
  HexLayout,
  GAME_HEX_SIZE,
  ROOM_CODE_CHARS,
  ROOM_CODE_LENGTH,
  PLAYER_NAME_MAX,
  GameRoom,
  RejoinSeat,
  TurnMode,
  CHAT_MESSAGE_MAX,
  MAX_SETUP_CITIES,
  MIN_TURN_TIMER_S,
  MAX_TURN_TIMER_S,
  CHAT_LOG_MAX,
  PASSWORD_MAX,
} from 'common';

import { createGameRoom, createBoard, gameRooms, resetRoom, freshResourceCount, STARTING_RESOURCES } from '../store';
// passKnockedOutTurn removed: leaveGame now keeps the seat like disconnect.
import { DEV_PRESET, applyDevPreset } from '../devPreset';
import { broadcastRoom } from '../broadcast';
import { MAX_ROOMS } from '../constants';
import { GameServer, HandlerContext } from './context';
import {
  clearResumeLobbyHash,
  hydrateRoom,
  pausedInfo,
  persistedMeta,
  resumeLobbyHash,
  setResumeLobbyHash,
  transition,
} from '../lifecycle';
import { remove as removePersisted } from '../persistence/gameRepository';
import { createAttemptLimiter, hashPassword, verifyPassword } from '../persistence/passwords';

/** A lobby name is letters, digits, space, _ or - (length checked by callers). */
const PLAYER_NAME_RE = /^[A-Za-z0-9 _-]+$/;

/** Host/lobby password probes per socket (brute-force guard). */
const passwordAttempts = createAttemptLimiter(8, 60_000);

/** Push the current paused/resuming info to every socket on the room channel. */
function broadcastPausedInfo(io: GameServer, roomId: string): void {
  const meta = persistedMeta(roomId);
  if (!meta || (meta.status !== 'paused' && meta.status !== 'resuming')) return;
  io.to(roomId).emit('pausedGameInfo', pausedInfo(roomId, meta, gameRooms.get(roomId)));
}

/**
 * Seats in a started game whose player dropped out (no live socket): the
 * picks offered by the rejoin picker. Knocked-out seats are included — the
 * player may still want to come back and watch from their own seat.
 */
function disconnectedSeats(room: GameRoom): RejoinSeat[] {
  return room.players.filter((p) => !p.connected).map((p) => ({ name: p.name, color: p.color }));
}

/**
 * Room-lifecycle handlers: joining (with seat tokens, color assignment and the
 * nested color/name-update handlers), regenerating the map, starting the game,
 * resetting, leaving, and disconnect cleanup.
 */
export function registerRoomHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // Every room this socket joined (as a seat or a spectator): on disconnect
  // the seat is marked offline and the socket dropped from spectators.
  const joinedRoomIds = new Set<string>();

  // Handle room joining.
  socket.on('joinRoom', (data: { roomId: string; playerName: string; color?: string; layouts?: HexLayout[]; token?: string }) => {
    const { roomId, color, layouts } = data;
    const token = typeof data.token === 'string' ? data.token : undefined;
    const playerName = typeof data.playerName === 'string' ? data.playerName.trim() : '';
    // Exactly ROOM_CODE_LENGTH chars drawn from ROOM_CODE_CHARS.
    if (
      typeof roomId !== 'string' ||
      roomId.length !== ROOM_CODE_LENGTH ||
      ![...roomId].every((c) => ROOM_CODE_CHARS.includes(c))
    ) {
      socket.emit('error', { message: 'Invalid room code' });
      return;
    }
    if (
      playerName &&
      (playerName.length > PLAYER_NAME_MAX || !PLAYER_NAME_RE.test(playerName))
    ) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    if (color !== undefined && !isHexColor(color)) {
      socket.emit('error', { message: 'Invalid color' });
      return;
    }
    let room = gameRooms.get(roomId);
    if (!room) {
      const meta = persistedMeta(roomId);
      if (meta?.status === 'paused') {
        // Cold row: nobody is playing it right now. Tell the joiner it is
        // paused; the room materializes only when the host reopens it.
        socket.join(roomId);
        joinedRoomIds.add(roomId);
        socket.emit('pausedGameInfo', pausedInfo(roomId, meta));
        return;
      }
      if (meta) {
        // Persisted game (autosaved live, resuming lobby, or finished):
        // hydrate the snapshot and continue through the normal join flow —
        // seat tokens saved before a restart re-attach below.
        room = hydrateRoom(roomId) ?? undefined;
      }
    }
    if (!room) {
      // A join that would CREATE a room is refused once the server is full.
      if (gameRooms.size >= MAX_ROOMS) {
        socket.emit('error', { message: 'Server is full' });
        return;
      }
      // If a custom board layout was provided, validate it BEFORE creating the
      // room so a rejected layout can't orphan an empty room.
      if (layouts && layouts.length > 0) {
        const ok = validateLayouts(layouts);
        if (!ok.allowed) {
          socket.emit('error', { message: ok.reason ?? 'Invalid board layout' });
          return;
        }
      }
      room = createGameRoom(roomId, playerName);
      if (layouts && layouts.length > 0) {
        room.board = generateBoard(layouts, { generator: 'custom', hexSize: GAME_HEX_SIZE });
        room.robberMove = null;
      }
    }
    // Re-attach a disconnected seat BEFORE the full/started checks — a full
    // room or a started game must not strand a player who is merely
    // reconnecting. The seat token alone proves ownership: a matching name is
    // NOT enough (that would let a stranger hijack a seat mid-game). An empty
    // playerName with a valid token also re-attaches (nameless rejoin).
    const seat = token ? room.players.find((p) => p.token === token) : undefined;
    if (seat) {
      seat.id = socket.id;
      seat.connected = true;
      room.spectators = room.spectators.filter((id) => id !== socket.id);
      socket.join(roomId);
      joinedRoomIds.add(roomId);
      if (seat.token) socket.emit('joined', { token: seat.token });
      applyBonuses(room);
      broadcastRoom(io, room, 'roomUpdate');
      broadcastPausedInfo(io, roomId);
      return;
    }
    // A reopened lobby collects seats through the resume screen instead of
    // adding new players: show its seat list (claims go through claimSeat
    // with the lobby password).
    if (room.gameStatus === 'resuming') {
      socket.join(roomId);
      joinedRoomIds.add(roomId);
      const meta = persistedMeta(roomId);
      if (meta) socket.emit('pausedGameInfo', pausedInfo(roomId, meta, room));
      return;
    }
    // A started game takes no new players. Someone arriving without a seat
    // token (a fresh link click, a new device, cleared storage) gets the
    // rejoin picker: the seats whose player dropped out, or — if nobody left
    // — just the option to spectate.
    if (room.gameStatus !== 'waiting') {
      socket.emit('rejoinOptions', { roomId, seats: disconnectedSeats(room) });
      return;
    }
    if (playerName && room.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
      socket.emit('error', { message: 'Seat taken' });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    // Assign a color: the requested one if it's distinct from everyone else's,
    // otherwise the first preset that is.
    const used = room.players.map((p) => p.color);
    const assigned =
      color && playerColorError(color, used) === null
        ? normalizeColor(color)
        : PLAYER_COLORS.find((c) => playerColorError(c, used) === null) ?? PLAYER_COLORS[0];
    // The seat token is a server-issued secret the client echoes back on every
    // joinRoom to prove ownership of this seat across reconnects.
    const seatToken = randomBytes(16).toString('hex');
    const player: Player = {
      id: socket.id,
      name: playerName,
      color: assigned,
      token: seatToken,
      resources: freshResourceCount(STARTING_RESOURCES),
      victoryPoints: 0,
      eliminated: false,
      connected: true,
      developmentCards: [],
      freeRoadsLeft: 0,
      devCardsBoughtThisTurn: 0,
    };

    room.players.push(player);
    room.turnState.playerOrder = room.players.map((p) => p.name);
    socket.join(roomId);
    joinedRoomIds.add(roomId);
    socket.emit('joined', { token: seatToken });

    // Send updated room state to all players.
    applyBonuses(room);
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Reclaim a disconnected seat from the rejoin picker. Only a seat with no
  // live socket can be claimed (a connected player's seat is never offered),
  // so a stranger can take over only a player who has actually left. The
  // claimer gets a fresh seat token: the old one stops working, so a stale tab
  // of the dropped player can't snatch the seat back mid-turn.
  socket.on('claimSeat', (data: { roomId: string; name: string; lobbyPassword?: string }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    // A reopened lobby gates seat claims behind its lobby password (set at
    // pause time). Live games keep the passwordless claim: the seat-picker is
    // already gated to seats whose owner dropped out.
    const lobbyHash = resumeLobbyHash(room.id);
    if (room.gameStatus === 'resuming' && lobbyHash) {
      if (!passwordAttempts.check(socket.id)) {
        socket.emit('error', { message: 'Too many attempts — try again shortly' });
        return;
      }
      if (typeof data.lobbyPassword !== 'string' || !verifyPassword(data.lobbyPassword, lobbyHash)) {
        socket.emit('error', { message: 'Wrong lobby password' });
        return;
      }
      passwordAttempts.reset(socket.id);
    }
    const seat = room.players.find((p) => p.name === data.name);
    if (!seat || seat.connected) {
      socket.emit('error', { message: 'That player is back — pick another seat' });
      if (room.gameStatus !== 'resuming') {
        socket.emit('rejoinOptions', { roomId: room.id, seats: disconnectedSeats(room) });
      }
      return;
    }
    seat.id = socket.id;
    seat.connected = true;
    seat.token = randomBytes(16).toString('hex');
    room.spectators = room.spectators.filter((id) => id !== socket.id);
    socket.join(room.id);
    joinedRoomIds.add(room.id);
    socket.emit('joined', { token: seat.token });
    applyBonuses(room);
    broadcastRoom(io, room, 'roomUpdate');
    broadcastPausedInfo(io, room.id);
  });

  // Watch a started game without a seat: room updates with every hand masked,
  // no actions (every action handler resolves the caller by seat socket id,
  // which a spectator never has).
  socket.on('spectateRoom', (data: { roomId: string }) => {
    let room = gameRooms.get(data?.roomId);
    if (!room) {
      // Same resolution as joinRoom: a paused row just reports its info;
      // persisted live/finished games hydrate and can be watched again.
      const meta = persistedMeta(data?.roomId);
      if (meta?.status === 'paused') {
        socket.join(data.roomId);
        joinedRoomIds.add(data.roomId);
        socket.emit('pausedGameInfo', pausedInfo(data.roomId, meta));
        return;
      }
      if (meta) room = hydrateRoom(data.roomId) ?? undefined;
    }
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.gameStatus === 'resuming') {
      // The resume lobby has nothing to spectate until the game continues.
      socket.join(room.id);
      joinedRoomIds.add(room.id);
      const meta = persistedMeta(room.id);
      if (meta) socket.emit('pausedGameInfo', pausedInfo(room.id, meta, room));
      return;
    }
    if (room.players.some((p) => p.id === socket.id && p.connected)) return;
    if (!room.spectators.includes(socket.id)) room.spectators.push(socket.id);
    socket.join(room.id);
    joinedRoomIds.add(room.id);
    broadcastRoom(io, room, 'roomUpdate');
  });
  // Change your color while still in the lobby. Registered at the top level
  // (not inside joinRoom) so it works for sockets that re-attached to a seat
  // via token after a reload — those return early from joinRoom.
  socket.on('updatePlayerColor', (data: { roomId: string; color: string }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room || (room.gameStatus !== 'waiting' && room.gameStatus !== 'resuming')) return;
    const p = room.players.find((pl) => pl.id === socket.id);
    if (!p) return;
    const requested = typeof data.color === 'string' ? data.color : '';
    const others = room.players.filter((pl) => pl.id !== socket.id).map((pl) => pl.color);
    const err = playerColorError(requested, others);
    if (err) {
      socket.emit('error', { message: err });
      return;
    }
    p.color = normalizeColor(requested);
    broadcastRoom(io, room, 'roomUpdate');
    if (room.gameStatus === 'resuming') broadcastPausedInfo(io, room.id);
  });

  // Set your name while still in the lobby (join is name-optional; the name
  // is chosen after joining). Top-level for the same reason as above.
  socket.on('updatePlayerName', (data: { roomId: string; name: string }) => {
    const room = gameRooms.get(data?.roomId);
    // Names are the foreign key for soldiers, settlements and turn order —
    // mid-game (a resuming lobby counts) renaming stays forbidden.
    if (!room || room.gameStatus !== 'waiting') return;
    const p = room.players.find((pl) => pl.id === socket.id);
    if (!p) return;
    const newName = typeof data.name === 'string' ? data.name.trim() : '';
    if (!newName || newName.length > PLAYER_NAME_MAX || !PLAYER_NAME_RE.test(newName)) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    if (room.players.some((pl) => pl.name.toLowerCase() === newName.toLowerCase())) {
      socket.emit('error', { message: 'That name is taken' });
      return;
    }
    // Re-point the turn only if the renamed seat is the one holding it.
    // Comparing names is wrong: nameless seats all share "" (a player who
    // names first would otherwise steal the creator's first setup turn and,
    // via the setup snake order, get three turns in a row). Capture the turn
    // holder's seat from the OLD order before renaming, then match by index.
    const seatIndex = room.players.indexOf(p);
    const turnSeatIndex = room.turnState.playerOrder.indexOf(room.turnState.player);
    p.name = newName;
    room.turnState.playerOrder = room.players.map((pl) => pl.name);
    if (turnSeatIndex === seatIndex) room.turnState.player = newName;
    broadcastRoom(io, room, 'roomUpdate');
  });

  socket.on('refreshMap', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    // Only the host may regenerate the map, and only before the game starts —
    // mid-game this would wipe every settlement, road, and soldier.
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'The game has already started' });
      return;
    }
    if (!room.players.some((p) => p.id === socket.id)) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can regenerate the map' });
      return;
    }
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
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can change settings' });
      return;
    }
    const value = Math.floor(pointsToWin);
    if (!Number.isFinite(value) || value < 1) {
      socket.emit('error', { message: 'Points to win must be at least 1' });
      return;
    }
    room.pointsToWin = value;
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Set the turn structure (Build/Action scope per round, plus the optional
  // second roll after an 'around' Build). Host only, while waiting — like
  // every other room setting.
  socket.on('setTurnMode', (data: { roomId: string; turnMode: TurnMode }) => {
    const { roomId, turnMode } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    if (room.players[0]?.id !== socket.id) {
      socket.emit('error', { message: 'Only the host can change settings' });
      return;
    }
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

  // How many setup placements may be cities (0..MAX_SETUP_CITIES). Host only,
  // while waiting — like every other room setting.
  socket.on('setSetupCities', (data: { roomId: string; setupCities: number }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    if (room.players[0]?.id !== socket.id) {
      socket.emit('error', { message: 'Only the host can change settings' });
      return;
    }
    const value = data.setupCities;
    if (!Number.isInteger(value) || value < 0 || value > MAX_SETUP_CITIES) {
      socket.emit('error', { message: `Setup cities must be 0 to ${MAX_SETUP_CITIES}` });
      return;
    }
    room.setupCities = value;
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Per-phase turn timer (0 = off). Host only, while waiting — like every
  // other room setting. Value arrives in ms; whole seconds only.
  socket.on('setTurnTimer', (data: { roomId: string; turnTimerMs: number }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'Can only change settings while waiting' });
      return;
    }
    if (room.players[0]?.id !== socket.id) {
      socket.emit('error', { message: 'Only the host can change settings' });
      return;
    }
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

  socket.on('editBoard', (data: { roomId: string; layouts: HexLayout[] }) => {
    const { roomId, layouts } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const ok = validateLayouts(layouts);
    if (!ok.allowed) {
      socket.emit('error', { message: ok.reason ?? 'Invalid board layout' });
      return;
    }
    // Only the host may replace the board, and only before the game starts —
    // mid-game this would wipe every settlement, road, and soldier.
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'The game has already started' });
      return;
    }
    if (!room.players.some((p) => p.id === socket.id)) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can edit the board' });
      return;
    }
    // Rebuild the board from the custom layout. Pre-game (waiting) this is
    // safe — nothing is built yet. The robber resets to the new desert.
    room.board = generateBoard(layouts, { generator: 'custom', hexSize: GAME_HEX_SIZE });
    room.robberMove = null;
    applyBonuses(room);
    broadcastRoom(io, room, 'roomUpdate');
  });
  socket.on('startGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
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
    // Dev mode: skip setup with a preset board (see devPreset.ts).
    if (DEV_PRESET) applyDevPreset(room);
    applyBonuses(room);
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Reset game.
  socket.on('resetGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
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

  // "Leave game" from the menu. A seated player is treated like a
  // disconnect: the seat stays (marked disconnected) so the same player can
  // re-attach by token, or another client can claim it from the rejoin
  // picker. Nothing about the turn or their pending actions changes.
  socket.on('leaveGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      // A spectator stops watching.
      if (room.spectators.includes(socket.id)) {
        room.spectators = room.spectators.filter((id) => id !== socket.id);
        socket.leave(roomId);
        broadcastRoom(io, room);
        return;
      }
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    player.connected = false;
    socket.leave(roomId);
    broadcastRoom(io, room, 'roomUpdate');
  });

  // Handle disconnect. The seat stays (with all its pieces) so its owner can
  // re-attach by token after a reload, or anyone with the room link can
  // reclaim it from the rejoin picker; a lobby seat is dropped since nothing
  // is lost. Abandoned rooms are reaped by the idle sweep (ROOM_IDLE_MS), not
  // here — deleting a room the moment its last socket closed made a game
  // unrejoinable after everyone's connection blipped at once.
  socket.on('disconnect', () => {
    for (const roomId of joinedRoomIds) {
      const room = gameRooms.get(roomId);
      if (!room) continue;
      room.spectators = room.spectators.filter((id) => id !== socket.id);
      const seat = room.players.find((p) => p.id === socket.id);
      if (seat) seat.connected = false;
      const anyoneConnected = room.players.some((p) => p.connected) || room.spectators.length > 0;
      if (room.gameStatus === 'waiting' && !anyoneConnected) {
        // An empty lobby has nothing to rejoin.
        gameRooms.delete(roomId);
        continue;
      }
      if (room.gameStatus === 'resuming' && !anyoneConnected) {
        // An abandoned resume lobby closes back to paused rather than
        // sitting open with its lobby password.
        transition(room, 'paused');
        gameRooms.delete(roomId);
        clearResumeLobbyHash(roomId);
        continue;
      }
      broadcastRoom(io, room, 'roomUpdate');
      if (room.gameStatus === 'resuming') broadcastPausedInfo(io, roomId);
    }
  });

  // ── Persisted-game lifecycle ──────────────────────────────────────────

  // Host pauses the running game: snapshot it to the DB with the passwords,
  // tell the room channel, and drop it from memory. The link now shows the
  // paused screen to anyone who opens it.
  socket.on('pauseGame', (data: { roomId: string; hostPassword: string; lobbyPassword: string }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room || room.gameStatus !== 'playing') {
      socket.emit('error', { message: 'No running game to pause' });
      return;
    }
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can pause the game' });
      return;
    }
    const hostPassword = typeof data.hostPassword === 'string' ? data.hostPassword : '';
    const lobbyPassword = typeof data.lobbyPassword === 'string' ? data.lobbyPassword : '';
    if (!hostPassword || hostPassword.length > PASSWORD_MAX ||
        !lobbyPassword || lobbyPassword.length > PASSWORD_MAX) {
      socket.emit('error', { message: 'Pick a host password and a lobby password (1–64 chars)' });
      return;
    }
    const err = transition(room, 'paused', {
      hostPasswordHash: hashPassword(hostPassword),
      lobbyPasswordHash: hashPassword(lobbyPassword),
    });
    if (err) {
      socket.emit('error', { message: err });
      return;
    }
    io.to(room.id).emit('pausedGameInfo', pausedInfo(room.id, persistedMeta(room.id)!));
    gameRooms.delete(room.id);
  });

  // Host (by host password) reopens a paused game: the snapshot hydrates as
  // a 'resuming' lobby and original seats claim back in with the lobby
  // password. Password verification is rate-limited per socket.
  socket.on('openResumeLobby', (data: { roomId: string; hostPassword: string }) => {
    if (gameRooms.get(data?.roomId)) {
      socket.emit('error', { message: 'This game is already open' });
      return;
    }
    const meta = persistedMeta(data?.roomId);
    if (!meta || meta.status !== 'paused') {
      socket.emit('error', { message: 'No paused game with that code' });
      return;
    }
    if (!passwordAttempts.check(socket.id)) {
      socket.emit('error', { message: 'Too many attempts — try again shortly' });
      return;
    }
    if (typeof data.hostPassword !== 'string' || !verifyPassword(data.hostPassword, meta.host_password_hash)) {
      socket.emit('error', { message: 'Wrong host password' });
      return;
    }
    passwordAttempts.reset(socket.id);
    const room = hydrateRoom(data.roomId, { allowPaused: true });
    if (!room) {
      socket.emit('error', { message: 'Saved game is unreadable' });
      return;
    }
    if (meta.lobby_password_hash) setResumeLobbyHash(room.id, meta.lobby_password_hash);
    transition(room, 'resuming');
    socket.join(room.id);
    joinedRoomIds.add(room.id);
    broadcastPausedInfo(io, room.id);
  });

  // The host's seat closes a resume lobby (back to paused). Reached from the
  // resume lobby's "Close" button.
  socket.on('closeResumeLobby', (data: { roomId: string }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room || room.gameStatus !== 'resuming') return;
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can close the lobby' });
      return;
    }
    transition(room, 'paused');
    io.to(room.id).emit('pausedGameInfo', pausedInfo(room.id, persistedMeta(room.id)!));
    gameRooms.delete(room.id);
    clearResumeLobbyHash(room.id);
  });

  // Cheap pre-check so the UI can validate a lobby password before a seat
  // pick. Verifies against the same hash claimSeat enforces.
  socket.on('unlockResumeLobby', (data: { roomId: string; lobbyPassword: string }) => {
    const room = gameRooms.get(data?.roomId);
    const meta = persistedMeta(data?.roomId);
    if (!room || room.gameStatus !== 'resuming' || !meta) {
      socket.emit('error', { message: 'No resume lobby with that code' });
      return;
    }
    if (!passwordAttempts.check(socket.id)) {
      socket.emit('error', { message: 'Too many attempts — try again shortly' });
      return;
    }
    if (typeof data.lobbyPassword !== 'string' || !verifyPassword(data.lobbyPassword, meta.lobby_password_hash)) {
      socket.emit('error', { message: 'Wrong lobby password' });
      return;
    }
    passwordAttempts.reset(socket.id);
    socket.emit('resumeLobbyUnlocked', { roomId: room.id });
  });
}
