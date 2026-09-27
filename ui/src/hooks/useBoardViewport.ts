import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_ZOOM, MIN_ZOOM, PAN_THRESHOLD, ZOOM_STEP } from '../constants';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Pan/zoom for the board SVG. The viewBox is expressed in board coordinates, so
 * zooming and panning are just moving a window over that space: zoom resizes the
 * window (center-anchored) and panning shifts its center. Attach the returned
 * `onMouseDown` / `onDoubleClick` to the `<svg>` element.
 *
 * Pan/zoom are driven imperatively (writing the `viewBox` attribute on the svg
 * element) rather than through React state: a per-frame `setState` would
 * re-render the whole SVG subtree on every wheel tick and mousemove. React only
 * re-renders when `isDirty` flips (to show/hide the reset button). Because the
 * `viewBox` prop passed to the `<svg>` never changes after mount, React's
 * reconciler never overwrites the imperatively-set attribute.
 *
 * Panning is a left-button drag on empty board space. Vertices, edges, and
 * soldier badges all stopPropagation on mousedown, so they keep their own
 * click/drag behavior and do not start a pan. Double-click zooms in;
 * Shift+double-click (or the reset button) restores the fit view.
 */
export function useBoardViewport(svgRef: React.RefObject<SVGSVGElement>, baseSize: number) {
  // Source of truth lives in refs so pan/zoom never triggers a React render.
  const zoomRef = useRef(1);
  const centerRef = useRef({ x: 0, y: 0 });
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number; active: boolean } | null>(null);
  // Only the "viewport differs from fit" flag is React state (drives the
  // reset button). It flips at most once per gesture.
  const [isDirty, setIsDirty] = useState(false);

  const half = baseSize / 2;

  /** Write the current zoom/center to the svg's viewBox attribute. */
  const applyViewBox = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const zoom = zoomRef.current;
    const { x, y } = centerRef.current;
    svg.setAttribute(
      'viewBox',
      `${x - half / zoom} ${y - half / zoom} ${(2 * half) / zoom} ${(2 * half) / zoom}`
    );
  }, [svgRef, half]);

  /** Screen pixels per board unit at the current zoom. */
  const pxPerBoard = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? rect.width / ((2 * half) / zoomRef.current) : 1;
  };

  const zoomBy = useCallback(
    (factor: number) => {
      zoomRef.current = clamp(zoomRef.current * factor, MIN_ZOOM, MAX_ZOOM);
      applyViewBox();
      setIsDirty(true);
    },
    [applyViewBox]
  );

  const reset = useCallback(() => {
    zoomRef.current = 1;
    centerRef.current = { x: 0, y: 0 };
    applyViewBox();
    setIsDirty(false);
  }, [applyViewBox]);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) reset();
      else zoomBy(ZOOM_STEP);
    },
    [reset, zoomBy]
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: centerRef.current.x,
      originY: centerRef.current.y,
      active: false,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      if (!pan.active) {
        if (Math.hypot(e.clientX - pan.startX, e.clientY - pan.startY) < PAN_THRESHOLD) return;
        pan.active = true;
      }
      const scale = pxPerBoard();
      centerRef.current = {
        x: pan.originX - (e.clientX - pan.startX) / scale,
        y: pan.originY - (e.clientY - pan.startY) / scale,
      };
      applyViewBox();
      setIsDirty(true);
    };
    const onUp = () => {
      panRef.current = null;
    };
    // Native non-passive wheel listener: React attaches `wheel` passively at the
    // root, so a synthetic handler's preventDefault() is ignored and the browser
    // also zooms/scrolls the page (the "double zoom"). A non-passive listener
    // can preventDefault(), so wheeling over the board zooms only the board.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    const svg = svgRef.current;
    if (svg) svg.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (svg) svg.removeEventListener('wheel', onWheel);
    };
    // pxPerBoard reads zoomRef (always current); zoomBy is a stable callback.
    // Re-runs only if the svg element or base size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRef, half, zoomBy, applyViewBox]);

  return {
    reset,
    isDirty,
    // Initial viewBox only; after mount the attribute is driven imperatively
    // (React leaves it alone because this prop value never changes).
    viewBox: `${-half} ${-half} ${2 * half} ${2 * half}`,
    onDoubleClick,
    onMouseDown,
  };
}
