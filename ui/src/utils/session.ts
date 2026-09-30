/**
 * Session persistence for the lobby join, so a page reload auto-rejoins the
 * same room instead of bouncing back to the lobby. All access is guarded:
 * sessionStorage may be unavailable (private mode, SSR), and that must never
 * break the app.
 */

import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH } from 'common';
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
    if (parsed && parsed.roomId) return { playerName: '', ...parsed } as SavedSession;
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
/** Read a shareable join code from the URL. Accepts `/join?id=CODE` and
    `/?id=CODE` / `/?room=CODE` (so a copied link works even if `/join` isn't
    SPA-served and the SPA lands on the root). */
export function joinCodeFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    const raw =
      url.searchParams.get('id') ??
      url.searchParams.get('room') ??
      (url.pathname.startsWith('/join')
        ? url.searchParams.get('id') ?? url.pathname.replace('/join/', '')
        : null);
    const id = (raw ?? '').toUpperCase().trim();
    if (id.length !== ROOM_CODE_LENGTH) return null;
    if (![...id].every((c) => ROOM_CODE_CHARS.includes(c))) return null;
    return id;
  } catch {
    return null;
  }
}
