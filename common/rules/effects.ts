/**
 * Effects a game action produces without performing I/O itself.
 *
 * Rules in `common/` mutate the room and return these; the transport
 * adapter (backend dispatch executor) performs them. This keeps the rules
 * free of socket.io so the same apply functions run headless in tests and
 * stay reusable by the UI's optimistic paths.
 */
import type { RobberFightResult } from '../types/SocketEvents';

export type GameEffect =
  /** Broadcast `robberFightResult` to every socket in the room. */
  | { kind: 'robberFightResult'; result: RobberFightResult }
  /** Push the refreshed paused/resuming info payload to the room channel. */
  | { kind: 'pausedInfo' };
