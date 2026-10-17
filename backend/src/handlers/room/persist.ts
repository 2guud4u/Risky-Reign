import { PASSWORD_MAX } from 'common';

import { getRoom, removeRoom } from '../../store';
import { HandlerContext } from '../context';
import {
  clearResumeLobbyHash,
  hydrateRoom,
  pausedInfo,
  persistedMeta,
  setResumeLobbyHash,
  transition,
} from '../../lifecycle';
import { hashPassword, verifyPassword } from '../../persistence/passwords';
import { broadcastPausedInfo, passwordAttempts } from './shared';

/**
 * Persisted-game lifecycle: pausing a running game to the DB, reopening it
 * as a 'resuming' lobby behind the host/lobby passwords, closing that lobby,
 * and the pre-check that validates a lobby password before a seat pick.
 */
export function registerPersistedGameHandlers(
  ctx: HandlerContext,
  joinedRoomIds: Set<string>
): void {
  const { io, socket } = ctx;

  // Host pauses the running game: snapshot it to the DB with the passwords,
  // tell the room channel, and drop it from memory. The link now shows the
  // paused screen to anyone who opens it.
  socket.on('pauseGame', (data: { roomId: string; hostPassword: string; lobbyPassword: string }) => {
    const room = getRoom(data?.roomId);
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
    removeRoom(room.id);
  });

  // Host (by host password) reopens a paused game: the snapshot hydrates as
  // a 'resuming' lobby and original seats claim back in with the lobby
  // password. Password verification is rate-limited per socket.
  socket.on('openResumeLobby', (data: { roomId: string; hostPassword: string }) => {
    if (getRoom(data?.roomId)) {
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
    const room = getRoom(data?.roomId);
    if (!room || room.gameStatus !== 'resuming') return;
    const isHost = room.players[0]?.id === socket.id;
    if (!isHost) {
      socket.emit('error', { message: 'Only the host can close the lobby' });
      return;
    }
    transition(room, 'paused');
    io.to(room.id).emit('pausedGameInfo', pausedInfo(room.id, persistedMeta(room.id)!));
    removeRoom(room.id);
    clearResumeLobbyHash(room.id);
  });

  // Cheap pre-check so the UI can validate a lobby password before a seat
  // pick. Verifies against the same hash claimSeat enforces.
  socket.on('unlockResumeLobby', (data: { roomId: string; lobbyPassword: string }) => {
    const room = getRoom(data?.roomId);
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
