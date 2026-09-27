/**
 * Persists DraggablePanel position/size across reloads, following the same
 * guarded sessionStorage pattern as session.ts (storage may be unavailable in
 * private mode / SSR, and that must never break the app).
 */

import { RESET_PANELS_EVENT } from '../constants';
import { SavedPanelLayout } from '../types/draggablePanel';

/** Return every DraggablePanel to its home rect (clears persisted layouts). */
export const resetAllPanels = (): void => {
  window.dispatchEvent(new Event(RESET_PANELS_EVENT));
};

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
    // Storage unavailable (private mode / quota) — the layout just won't persist.
  }
}
