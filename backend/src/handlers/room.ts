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
} from 'common';

import { createGameRoom, createBoard, gameRooms, resetRoom, freshResourceCount, STARTING_RESOURCES } from '../store';
import { passKnockedOutTurn } from '../turn';
import { DEV_PRESET, applyDevPreset } from '../devPreset';
import { broadcastRoom } from '../broadcast';
import { MAX_ROOMS } from '../constants';
import { HandlerContext } from './context';

/** A lobby name is letters, digits, space, _ or - (length checked by callers). */
const PLAYER_NAME_RE = /^[A-Za-z0-9 _-]+$/;

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
  socket.on('claimSeat', (data: { roomId: string; name: string }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const seat = room.players.find((p) => p.name === data.name);
    if (!seat || seat.connected) {
      socket.emit('error', { message: 'That player is back — pick another seat' });
      socket.emit('rejoinOptions', { roomId: room.id, seats: disconnectedSeats(room) });
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
  });

  // Watch a started game without a seat: room updates with every hand masked,
  // no actions (every action handler resolves the caller by seat socket id,
  // which a spectator never has).
  socket.on('spectateRoom', (data: { roomId: string }) => {
    const room = gameRooms.get(data?.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
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
    if (!room || room.gameStatus !== 'waiting') return;
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
  });

  // Set your name while still in the lobby (join is name-optional; the name
  // is chosen after joining). Top-level for the same reason as above.
  socket.on('updatePlayerName', (data: { roomId: string; name: string }) => {
    const room = gameRooms.get(data?.roomId);
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
    // The turn may have landed on a knocked-out player.
    passKnockedOutTurn(room);
    broadcastRoom(io, room);
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
      broadcastRoom(io, room, 'roomUpdate');
    }
  });
}
