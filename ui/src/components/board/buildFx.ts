import { useSyncExternalStore } from 'react';

/**
 * Which board pieces a running build animation currently stands in for.
 * BoardVertex/BoardEdge hide their real sprite/road while the animation
 * layer plays the pop/grow/smoke, so the piece doesn't double-render.
 * Token-based: finishing an old animation can't un-hide a piece whose
 * location has since started a new animation (settlement → city upgrades
 * while the settlement pop still plays).
 */

const hidden = new Map<string, symbol>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/** Claim a location's piece for `anim` and return the token to release with. */
export function hidePiece(id: string): symbol {
  const token = Symbol(id);
  hidden.set(id, token);
  emit();
  return token;
}

/** Release a location — no-op if a newer animation already claimed it. */
export function showPiece(id: string, token: symbol): void {
  if (hidden.get(id) === token) {
    hidden.delete(id);
    emit();
  }
}

/** Drop all claims (e.g. the animation layer unmounts mid-flight). */
export function clearHiddenPieces(): void {
  if (hidden.size === 0) return;
  hidden.clear();
  emit();
}

/** React subscription: is this vertex/edge's piece being animated right now? */
export function usePieceHidden(id: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => hidden.has(id)
  );
}
