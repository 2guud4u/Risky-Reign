import { useEffect, useRef } from 'react';

/**
 * Run `reset` whenever `active` turns false. Prompt state (pick counts,
 * selected victims) must die with the prompt so a stale selection from a
 * previous round can't pre-enable the next one — this is the single seam for
 * that rule, replacing per-prompt useEffect copies.
 *
 * `reset` is read through a ref: callers may pass a fresh closure every
 * render without re-triggering the effect.
 */
export const useResetOn = (active: boolean, reset: () => void): void => {
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    if (!active) resetRef.current();
  }, [active]);
};
