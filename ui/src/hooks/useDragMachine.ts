import { useCallback, useEffect, useRef, useState } from 'react';
import { PixelCoord } from 'common';
import { mouseToSvgPoint } from '../utils/boardInteraction';
import { DragSettle } from '../types/board';

/**
 * The game-agnostic drag state machine: a single active drag session,
 * pointer-move tracking into SVG world coords, and the drop/settle lifecycle.
 * What a drop MEANS is the caller's business — `onDrop` receives the session
 * and returns the landing (a `DragSettle` without `from`, which the machine
 * fills with the cursor position) or null to swallow the drop.
 *
 * The machine owns: one-at-a-time sessions, primary-pointer guards, Escape
 * cancellation, the post-drop ghost spring. It knows nothing about soldiers,
 * robbers, or boards.
 */
export function useDragMachine<D>(opts: {
  /** The svg element pointer coords are projected onto. */
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** Written true while a session is live so the touch layer can suppress pan/pinch. */
  dragActiveRef: React.MutableRefObject<boolean>;
  /** Resolve a drop; return the settle landing or null to swallow it. */
  onDrop: (drag: D, mousePos: PixelCoord | null) => Omit<DragSettle, 'from'> | null;
  /** Extra cleanup on Escape (e.g. clearing the board selection). */
  onEscape?: () => void;
}) {
  const { svgRef, dragActiveRef, onDrop, onEscape } = opts;

  const [drag, setDrag] = useState<D | null>(null);
  const [mousePos, setMousePos] = useState<PixelCoord | null>(null);
  // Post-drop settle: the ghost springs to its landing (or snaps back).
  const [settle, setSettle] = useState<DragSettle | null>(null);

  // Latest-values ref so the memoized callbacks read current drag state
  // without those values being in their dependency lists.
  const stateRef = useRef({ drag, mousePos });
  stateRef.current = { drag, mousePos };
  dragActiveRef.current = drag !== null;

  const cancelDrag = useCallback(() => {
    setDrag(null);
    setMousePos(null);
  }, []);

  const beginDrag = useCallback((d: D) => setDrag(d), []);

  // Escape cancels any in-progress drag (and whatever else the caller clears).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      cancelDrag();
      onEscape?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelDrag, onEscape]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.isPrimary === false) return; // a second finger: not the drag pointer
      if (!stateRef.current.drag) return;
      setMousePos(mouseToSvgPoint(e, svgRef.current));
    },
    [svgRef]
  );

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent) => {
      // A second finger's release must not resolve (or cancel) the drag.
      if (e && e.isPrimary === false) return;
      const { drag: d, mousePos: mp } = stateRef.current;
      if (!d) return;
      setDrag(null);
      setMousePos(null);
      const landing = onDrop(d, mp);
      if (landing && mp) setSettle({ ...landing, from: mp });
    },
    [onDrop]
  );

  return {
    drag,
    mousePos,
    settle,
    clearSettle: () => setSettle(null),
    beginDrag,
    cancelDrag,
    handlePointerMove,
    handlePointerUp,
  };
}
