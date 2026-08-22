/**
 * Session persistence for the lobby join, so a page reload auto-rejoins the
 * same room instead of bouncing back to the lobby. All access is guarded:
 * sessionStorage may be unavailable (private mode, SSR), and that must never
 * break the app.
 */

import { SavedSession } from '../types';

const SESSION_KEY = 'joinedRoom';

/** Persist a join so a reload auto-rejoins (no-op if storage is unavailable). */
export function saveSession(session: SavedSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage unavailable — ignore.
  }
}

/** Read the persisted join (null if absent or invalid). */
export function readSavedSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.roomId && parsed.playerName) return parsed as SavedSession;
    return null;
  } catch {
    return null;
  }
}

/** Clear the persisted join (no-op if storage is unavailable). */
export function clearSavedSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
