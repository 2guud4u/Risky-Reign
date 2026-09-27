import { gameRooms } from './store';
import { ROOM_IDLE_MS, ROOM_SWEEP_INTERVAL_MS } from './constants';

/**
 * Periodically delete rooms that have seen no activity for `ROOM_IDLE_MS`.
 * Combined with the room cap and disconnect seat-expiry, this bounds how much
 * memory a flood of created rooms can consume. The timer is unref'd so it
 * never keeps the process alive on its own.
 */
export function startRoomSweep(): void {
  const timer = setInterval(() => {
    const cutoff = Date.now() - ROOM_IDLE_MS;
    for (const [id, room] of gameRooms) {
      if (room.lastActivityAt < cutoff) {
        gameRooms.delete(id);
      }
    }
  }, ROOM_SWEEP_INTERVAL_MS);
  timer.unref();
}
