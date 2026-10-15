import { randomBytes } from 'crypto';
import {
  PLAYER_COLORS,
  isHexColor,
  normalizeColor,
  playerColorError,
  Player,
  applyBonuses,
  MAX_PLAYERS,
  validateLayouts,
  generateBoard,
  HexLayout,
  GAME_HEX_SIZE,
  ROOM_CODE_CHARS,
  ROOM_CODE_LENGTH,
  PLAYER_NAME_MAX,
} from 'common';

import { createGameRoom, gameRooms, freshResourceCount, STARTING_RESOURCES } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { MAX_ROOMS } from '../../constants';
import { HandlerContext } from '../context';
import { hydrateRoom, pausedInfo, persistedMeta } from '../../lifecycle';
import { broadcastPausedInfo, disconnectedSeats, PLAYER_NAME_RE } from './shared';

/**
 * Room joining: create-or-attach, seat-token re-attach, the resume-lobby and
 * rejoin-picker branches. `joinedRoomIds` records every room this socket
 * joined (seat or spectator) so the disconnect handler in seats.ts knows
 * which rooms to sweep.
 */
export function registerJoinHandlers(ctx: HandlerContext, joinedRoomIds: Set<string>): void {
  const { io, socket } = ctx;

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
}
