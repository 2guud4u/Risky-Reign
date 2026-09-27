/**
 * Server-side resource and security limits. These cap how much memory a
 * hostile or careless client can consume so a flood can't exhaust the host.
 */

/** Maximum live rooms; `joinRoom` rejects creation past this cap. */
export const MAX_ROOMS = 500;

/** A room idle this long (no events) is deleted by the periodic sweep. */
export const ROOM_IDLE_MS = 4 * 60 * 60 * 1000; // 4 hours

/** How often the idle-room sweep runs. */
export const ROOM_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/** A disconnected seat is held this long before the player is dropped. */
export const SEAT_GRACE_MS = 2 * 60 * 1000; // 2 minutes
