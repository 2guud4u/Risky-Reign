import { randomBytes } from 'crypto';
import { normalizeColor, playerColorError, applyBonuses, PLAYER_NAME_MAX } from 'common';

import { gameRooms } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, requireRoom } from '../context';
import {
  clearResumeLobbyHash,
  hydrateRoom,
  pausedInfo,
  persistedMeta,
  resumeLobbyHash,
  transition,
} from '../../lifecycle';
import { verifyPassword } from '../../persistence/passwords';
import { broadcastPausedInfo, disconnectedSeats, passwordAttempts, PLAYER_NAME_RE } from './shared';

/**
 * Seat membership and presence: reclaiming a dropped seat, spectating, lobby
 * color/name changes, leaving, and disconnect cleanup. `joinedRoomIds` (built
 * by join.ts handlers) scopes disconnect cleanup to the rooms this socket
 * actually joined.
 */
export function registerSeatHandlers(ctx: HandlerContext, joinedRoomIds: Set<string>): void {
  const { io, socket } = ctx;

  // Reclaim a disconnected seat from the rejoin picker. Only a seat with no
  // live socket can be claimed (a connected player's seat is never offered),
  // so a stranger can take over only a player who has actually left. The
  // claimer gets a fresh seat token: the old one stops working, so a stale tab
  // of the dropped player can't snatch the seat back mid-turn.
  socket.on('claimSeat', (data: { roomId: string; name: string; lobbyPassword?: string }) => {
    const room = requireRoom(socket, data?.roomId);
    if (!room) return;
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

  // "Leave game" from the menu. A seated player is treated like a
  // disconnect: the seat stays (marked disconnected) so the same player can
  // re-attach by token, or another client can claim it from the rejoin
  // picker. Nothing about the turn or their pending actions changes.
  socket.on('leaveGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = requireRoom(socket, roomId);
    if (!room) return;
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
}
