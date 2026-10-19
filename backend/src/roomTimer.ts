/**
 * Per-room timer machinery shared by the broadcast-funnel timers (phase,
 * wall gate, cannon-shot reveal). Handles are runtime-only, keyed by
 * `${kind}:${roomId}`, and each armed entry carries a caller-supplied
 * `token` — the caller's expire path uses it as a staleness guard; this
 * map only owns arming, clearing, and firing.
 *
 * Every timed room state is synced at the end of `broadcastRoom`, so a
 * timer is always armed/disarmed relative to the room state that just
 * went out.
 */
type Entry = { handle: NodeJS.Timeout; token: unknown };

const timers = new Map<string, Entry>();

/**
 * Replace the room's `kind` timer: clears any handle already armed and
 * records `token` for `armedRoomTimer`. `onExpire` runs after `delayMs`
 * (unref'd — a timer must never keep the process alive).
 */
export function armRoomTimer(
  roomId: string,
  kind: string,
  delayMs: number,
  token: unknown,
  onExpire: () => void
): void {
  const key = `${kind}:${roomId}`;
  clearTimeout(timers.get(key)?.handle);
  const handle = setTimeout(() => {
    timers.delete(key);
    onExpire();
  }, delayMs);
  handle.unref?.();
  timers.set(key, { handle, token });
}

/** The token the room's `kind` timer was armed with (undefined when disarmed). */
export function armedRoomTimer(roomId: string, kind: string): unknown {
  return timers.get(`${kind}:${roomId}`)?.token;
}

/** Clear the room's `kind` timer if one is armed. */
export function disarmRoomTimer(roomId: string, kind: string): void {
  const key = `${kind}:${roomId}`;
  clearTimeout(timers.get(key)?.handle);
  timers.delete(key);
}
