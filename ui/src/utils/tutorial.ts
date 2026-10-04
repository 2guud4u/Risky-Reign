/**
 * Tutorial hints preference (setup coach + idle "Need help?" card), shared by
 * every component that shows a hint. Persisted in localStorage so a player
 * who turned hints off isn't coached again next game; all access is guarded
 * (storage may be unavailable, which must never break the app).
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'tutorialHints';
const CHANGE_EVENT = 'tutorial-hints-change';

function readHintsOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Turn tutorial hints on/off everywhere (and remember the choice). */
export function setTutorialHints(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // localStorage unavailable — the change still applies for this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Whether tutorial hints are on (re-renders when toggled anywhere). */
export function useTutorialHints(): boolean {
  return useSyncExternalStore(subscribe, readHintsOn, () => true);
}
