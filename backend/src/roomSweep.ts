import { Server } from 'socket.io';
import { RESUME_LOBBY_IDLE_MS } from 'common';
import { gameRooms } from './store';
import { ROOM_IDLE_MS, ROOM_SWEEP_INTERVAL_MS, EXPIRY_SWEEP_INTERVAL_MS } from './constants';
import { closeResumingRoom, clearResumeLobbyHash } from './lifecycle';
import { deleteExpired } from './persistence/gameRepository';

/**
 * Periodic sweeps.
 *
 * Idle pass (every `ROOM_SWEEP_INTERVAL_MS`): evict rooms with no activity for
 * `ROOM_IDLE_MS`. Persisted rooms keep their DB row — eviction just frees
 * memory, the next join hydrates the snapshot again. 'resuming' lobbies
 * instead close back to 'paused' so the lobby password stops accepting claims.
 *
 * Expiry pass (every `EXPIRY_SWEEP_INTERVAL_MS`): delete DB rows past the
 * 7-day TTL. Live in-memory rooms that lose their row keep running; the next
 * autosave recreates the row. A room that is *only* persisted (paused, or an
 * evicted snapshot) is gone for good — clients holding its code get
 * 'gameExpired' the next time they touch the server, and any currently
 * connected lobby/gamers get it immediately.
 */
export function startRoomSweep(io: Server): void {
  const idle = setInterval(() => {
    const cutoff = Date.now() - ROOM_IDLE_MS;
    const resumeCutoff = Date.now() - RESUME_LOBBY_IDLE_MS;
    for (const [id, room] of gameRooms) {
      if (room.gameStatus === 'resuming' && room.lastActivityAt < resumeCutoff) {
        // An idle resume lobby closes back to paused rather than sitting
        // open with its lobby password. The row stays for reopening.
        closeResumingRoom(room);
        gameRooms.delete(id);
      } else if (room.lastActivityAt < cutoff) {
        gameRooms.delete(id);
        clearResumeLobbyHash(id);
      }
    }
  }, ROOM_SWEEP_INTERVAL_MS);
  idle.unref();

  const expiry = setInterval(() => {
    const removed = deleteExpired(Date.now());
    for (const id of removed) {
      const room = gameRooms.get(id);
      if (room) {
        // Tell connected players, then evict: the row (their save) is gone.
        io.to(id).emit('gameExpired', { roomId: id });
        for (const p of room.players) {
          if (p.id) io.sockets.sockets.get(p.id)?.leave(id);
        }
        gameRooms.delete(id);
        clearResumeLobbyHash(id);
      }
    }
  }, EXPIRY_SWEEP_INTERVAL_MS);
  expiry.unref();
}
