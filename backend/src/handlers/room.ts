import { randomBytes } from 'crypto';
import {
  PLAYER_COLORS,
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
} from 'common';

import { createGameRoom, createBoard, gameRooms, resetRoom, freshResourceCount, STARTING_RESOURCES } from '../store';
import { broadcastRoom } from '../broadcast';
import { MAX_ROOMS } from '../constants';
import { HandlerContext } from './context';

/** A lobby name is letters, digits, space, _ or - (length checked by callers). */
const PLAYER_NAME_RE = /^[A-Za-z0-9 _-]+$/;

/**
 * Room-lifecycle handlers: joining (with seat tokens, color assignment and the
 * nested color/name-update handlers), regenerating the map, starting the game,
 * resetting, leaving, and disconnect cleanup.
 */
export function registerRoomHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // Every room this socket joined. On disconnect a room whose last socket is
  // gone is reaped; players stay while ANY socket remains so reconnect works.
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
    if (color !== undefined && !PLAYER_COLORS.includes(color)) {
      socket.emit('error', { message: 'Invalid color' });
      return;
    }
    let room = gameRooms.get(roomId);
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
      socket.join(roomId);
      joinedRoomIds.add(roomId);
      socket.emit('joined', { token: seat.token });
      applyBonuses(room);
      broadcastRoom(io, room, 'roomUpdate');
      return;
    }
    if (playerName && room.players.some((p) => p.name === playerName)) {
      socket.emit('error', { message: 'Seat taken' });
      return;
    }
    // New players only join a waiting lobby, and only if there's room.
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'The game has already started' });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    // Assign a color: the requested one if free, otherwise the first available.
    const used = new Set(room.players.map((p) => p.color));
    let assigned = color;
    if (!assigned || used.has(assigned)) {
      assigned = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
    }
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
      developmentCards: [],
      freeRoadsLeft: 0,
      devCardsBoughtThisTurn: 0,
      bankTradesThisTurn: freshResourceCount(0),
    };

    room.players.push(player);
    room.turnState.playerOrder = room.players.map((p) => p.name);
    socket.join(roomId);
    joinedRoomIds.add(roomId);
    socket.emit('joined', { token: seatToken });

    // Send updated room state to all players.
    applyBonuses(room);
    broadcastRoom(io, room, 'roomUpdate');

    // Allow the player to change their color while still in the lobby.
    socket.on('updatePlayerColor', (cData: { color: string }) => {
      const p = room.players.find((pl) => pl.id === socket.id);
      if (!p) return;
      const requested = cData.color;
      if (!PLAYER_COLORS.includes(requested)) return;
      const taken = new Set(
        room.players.filter((pl) => pl.id !== socket.id).map((pl) => pl.color)
      );
      p.color = !taken.has(requested) ? requested : PLAYER_COLORS.find((c) => !taken.has(c)) ?? p.color;
      broadcastRoom(io, room, 'roomUpdate');
    });
    // Allow the player to set their name while still in the lobby (join is
    // name-optional; the name is chosen after joining).
    socket.on('updatePlayerName', (nData: { name: string }) => {
      const p = room.players.find((pl) => pl.id === socket.id);
      if (!p || room.gameStatus !== 'waiting') return;
      const newName = typeof nData.name === 'string' ? nData.name.trim() : '';
      if (!newName || newName.length > PLAYER_NAME_MAX || !PLAYER_NAME_RE.test(newName)) return;
      if (room.players.some((pl) => pl.name === newName)) return; // names must stay unique
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
    // Re-start is forbidden: only the host may start, and only from waiting.
    if (room.gameStatus !== 'waiting') {
      socket.emit('error', { message: 'The game has already started' });
      return;
    }
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.players.length < MIN_PLAYERS) {
      socket.emit('error', { message: `Need at least ${MIN_PLAYERS} players to start` });
      return;
    }
    room.gameStatus = 'playing';
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
    resetRoom(room);
    // "Play Again" returns the room to the lobby (waiting room).
    room.gameStatus = 'waiting';
    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // A player leaves the game: remove them from the room and the turn order.
  // If they were the current player, pass the turn to the next player (or to
  // the sentinel 'X' if the room is now empty).
  socket.on('leaveGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    const leavingName = player.name;
    const orderIndex = room.turnState.playerOrder.indexOf(leavingName);
    const seatIndex = room.players.indexOf(player);
    room.players = room.players.filter((p) => p.id !== socket.id);
    // Remove the leaver's seat by index, not by name — nameless seats share
    // "" so a name filter would drop more than one order entry.
    room.turnState.playerOrder.splice(seatIndex, 1);
    if (room.turnState.player === leavingName) {
      room.turnState.player =
        room.turnState.playerOrder.length > 0
          ? room.turnState.playerOrder[orderIndex % room.turnState.playerOrder.length]
          : 'X';
    }
    // The round's dice owner is an index into playerOrder; removing the leaver
    // shifts everyone after them left, so re-point it at the same owner. If the
    // leaver WAS the owner, the next player in order inherits the index.
    if (orderIndex >= 0 && orderIndex < room.turnState.dicePlayerIndex) {
      room.turnState.dicePlayerIndex -= 1;
    }
    if (room.turnState.playerOrder.length > 0) {
      room.turnState.dicePlayerIndex %= room.turnState.playerOrder.length;
    } else {
      room.turnState.dicePlayerIndex = 0;
    }
    // Clear any state owned by the leaver so it can't wedge the game (a pending
    // 7-discard or robber move would otherwise block the Dice phase forever).
    delete room.discards[leavingName];
    if (room.robberMove?.player === leavingName) room.robberMove = null;
    if (room.steal?.thief === leavingName) room.steal = null;
    if (room.devCardChoice?.player === leavingName) room.devCardChoice = null;
    if (room.robberDefeatedBy?.playerName === leavingName) room.robberDefeatedBy = null;
    room.tradeOffers = room.tradeOffers.filter(
      (o) => o.from !== leavingName && o.to !== leavingName
    );
    // If the leaver was in an in-progress battle, drop it (it can never resolve
    // once a participant is gone).
    if (room.battleState && (room.battleState.attacker === leavingName || room.battleState.defender === leavingName)) {
      room.battleState = null;
    }
    socket.leave(roomId);
    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // Handle disconnect.
  socket.on('disconnect', () => {
    // Keep the players in the room so a reload / reconnect can re-attach while
    // ANY socket remains. Once the room's last socket is gone it can never be
    // rejoined (socket.io rooms die with their last member), so delete it here
    // instead of letting abandoned rooms pile up until the idle sweep.
    for (const roomId of joinedRoomIds) {
      const members = io.sockets.adapter.rooms.get(roomId);
      if (!members || members.size === 0) gameRooms.delete(roomId);
    }
  });
}
