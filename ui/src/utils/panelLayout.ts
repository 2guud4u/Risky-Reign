/**
 * Persists DraggablePanel position/size across reloads, following the same
 * guarded sessionStorage pattern as session.ts (storage may be unavailable in
 * private mode / SSR, and that must never break the app).
 */

import { SavedPanelLayout } from '../types';

const PREFIX = 'panelLayout:';

/** Read a saved panel layout (null if absent or invalid). */
export function loadPanelLayout(key: string): SavedPanelLayout | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as SavedPanelLayout;
    return null;
  } catch {
    return null;
  }
}

/** Persist a panel layout (no-op if storage is unavailable). */
export function savePanelLayout(key: string, layout: SavedPanelLayout): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(layout));
  } catch {
    // ignore
  }
}
