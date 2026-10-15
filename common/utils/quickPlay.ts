import { DEFAULT_POINTS_TO_WIN, MAX_PLAYERS } from '../Constant';
import { GameRoom } from '../types/Room';
import { TURN_MODE_PRESETS } from './turnOrder';

/**
 * Quick Play's "open room" rule — the single source the server's picker and
 * any UI hint read. A room is open to Quick Play while it is:
 *  - still in the waiting lobby (started/finished/resuming rooms are out),
 *  - not passworded (a password is what makes a room private),
 *  - still on every default setting (a host touching points/turn mode/
 *    setup cities/timer takes their room out of the pool),
 *  - and has a free seat.
 */
export function quickPlayEligible(room: GameRoom): boolean {
  if (room.gameStatus !== 'waiting') return false;
  if (room.passwordHash) return false;
  if (room.players.length >= MAX_PLAYERS) return false;
  const m = room.turnMode;
  const d = TURN_MODE_PRESETS.expanded;
  return (
    room.pointsToWin === DEFAULT_POINTS_TO_WIN &&
    m.build === d.build &&
    m.action === d.action &&
    m.secondRoll === d.secondRoll &&
    room.setupCities === 0 &&
    room.turnTimerMs === 0
  );
}

/**
 * Pick the Quick Play destination from candidate rooms: the fullest eligible
 * lobby wins so games fill up (and start) sooner; ties go to the room that
 * comes first in iteration order (Map iteration is insertion order — the
 * longest-waiting room).
 */
export function pickQuickPlayRoom(rooms: Iterable<GameRoom>): GameRoom | null {
  let best: GameRoom | null = null;
  for (const room of rooms) {
    if (!quickPlayEligible(room)) continue;
    if (!best || room.players.length > best.players.length) best = room;
  }
  return best;
}
