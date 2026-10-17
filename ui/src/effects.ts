/**
 * Typed effect bus: one-off UI commands that cross component boundaries
 * (fly spent resources, open the trade window, refit the board, retell a
 * tutorial pref) without forcing the command through React state — the old
 * `window.dispatchEvent` channels, but type-checked at emit and subscribe.
 */

import { useEffect, useRef } from 'react';
import { BuildAnimationInfo } from './types/buildAnimation';
import { OpenTradeDetail } from './types/openTrade';

export interface EffectMap {
  /** Spent resources fly from the resource panel to the build location. */
  buildAnimation: BuildAnimationInfo;
  /** Open the trade window (from a port click; presets the bank form). */
  openTrade: OpenTradeDetail;
  /** Zoom the board back out to the full view (e.g. the robber's Move bubble). */
  boardFit: void;
  /** The tutorial-hints preference changed (same-tab; other tabs use 'storage'). */
  tutorialHintsChange: void;
}

type Listener<K extends keyof EffectMap> = (payload: EffectMap[K]) => void;

const listeners: Record<keyof EffectMap, Set<Listener<keyof EffectMap>>> = {
  buildAnimation: new Set(),
  openTrade: new Set(),
  boardFit: new Set(),
  tutorialHintsChange: new Set(),
};

/** Subscribe to an effect; returns the unsubscribe function. */
export function onEffect<K extends keyof EffectMap>(
  event: K,
  listener: Listener<K>
): () => void {
  const set = listeners[event] as Set<Listener<K>>;
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** Emit an effect to every subscriber, synchronously. */
export function emitEffect<K extends keyof EffectMap>(
  event: K,
  ...args: EffectMap[K] extends void ? [] : [payload: EffectMap[K]]
): void {
  (listeners[event] as Set<Listener<K>>).forEach((fn) => fn(args[0] as EffectMap[K]));
}

/**
 * React hook form of `onEffect`: subscribes for the component's lifetime and
 * always calls the latest handler (no re-subscribe per render).
 */
export function useOnEffect<K extends keyof EffectMap>(
  event: K,
  handler: Listener<K>
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => onEffect(event, (payload) => handlerRef.current(payload)), [event]);
}
