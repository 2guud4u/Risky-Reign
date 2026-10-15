import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DETAIL_ZOOM_IN,
  FOCUS_DURATION_MS,
  MAX_ZOOM,
  MIN_ZOOM,
  PAN_THRESHOLD,
  PINCH_MIN_DIST,
  ZOOM_STEP,
} from '../constants';
import { beginPan, beginPinch, panStep, pinchStep, touchesDragHandle, PanGesture, PinchGesture } from '../utils/viewportGestures';

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
 * soldier badges keep their own click behavior; draggable pieces
 * (`data-drag-handle`: soldiers, the robber) are detected by attribute so a
 * piece drag never arms a pan on mouse or touch. Double-click zooms in;
 * Shift+double-click (or the reset button) restores the fit view. `focusOn`
 * animates the view to a board point (used when a vertex is clicked).
 */
export function useBoardViewport(
  svgRef: React.RefObject<SVGSVGElement>,
  baseSize: number,
  /** The svg's on-screen size. The view always shows at least `baseSize`
   *  board units on the shorter side and extends on the longer side, so the
   *  map fills the whole area instead of a letterboxed square. */
  screen: { w: number; h: number } | null,
  /** Shared flag with the drag hook: true while a soldier/robber drag is
   *  live. Read by the touch handlers so a second finger can't pinch while
   *  a piece is in hand. */
  dragActiveRef: React.MutableRefObject<boolean>
) {
  const dragRef = dragActiveRef;
  // Source of truth lives in refs so pan/zoom never triggers a React render.
  const zoomRef = useRef(1);
  const centerRef = useRef({ x: 0, y: 0 });
  const panRef = useRef<PanGesture | null>(null);
  // Two-finger pinch state: the two touches' distance, and the zoom/center
  // at the previous move (zoom is a ratio on the distance; the midpoint
  // anchors the zoom point on screen).
  const pinchRef = useRef<PinchGesture | null>(null);
  // Handle of the in-flight focus animation, so a new gesture can cancel it.
  const animRef = useRef<number | null>(null);
  // Pending once-per-frame viewBox write (pan/wheel can fire many times a frame).
  const frameRef = useRef<number | null>(null);
  // Only the "viewport differs from fit" flag is React state (drives the
  // reset button). It flips at most once per gesture.
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const markDirty = useCallback((dirty: boolean) => {
    if (dirtyRef.current === dirty) return;
    dirtyRef.current = dirty;
    setIsDirty(dirty);
  }, []);
  // The view before a click-to-focus, so closing the selection can return to it.
  const savedViewRef = useRef<{ zoom: number; center: { x: number; y: number }; dirty: boolean } | null>(null);

  // Half-extents of the view in board units at zoom 1. The shorter screen
  // side spans `baseSize`; the longer side spans proportionally more.
  const aspect = screen && screen.w > 0 && screen.h > 0 ? screen.w / screen.h : 1;
  const halfW = (aspect >= 1 ? baseSize * aspect : baseSize) / 2;
  const halfH = (aspect >= 1 ? baseSize : baseSize / aspect) / 2;
  const extentRef = useRef({ halfW, halfH });
  extentRef.current = { halfW, halfH };

  // Individual soldiers are visible only at or above the detail threshold.
  // Re-render only when crossing that boundary.
  const [detailed, setDetailed] = useState(false);
  const detailedRef = useRef(false);

  /** Write the current zoom/center to the svg's viewBox attribute. */
  const applyViewBox = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const zoom = zoomRef.current;
    const { x, y } = centerRef.current;
    const { halfW: hw, halfH: hh } = extentRef.current;
    svg.setAttribute(
      'viewBox',
      `${x - hw / zoom} ${y - hh / zoom} ${(2 * hw) / zoom} ${(2 * hh) / zoom}`
    );
    const next = zoom >= DETAIL_ZOOM_IN;
    if (next !== detailedRef.current) {
      detailedRef.current = next;
      setDetailed(next);
    }
  }, [svgRef]);

  // Re-fit the view when the area resizes (keeps the current zoom/center).
  useEffect(() => {
    applyViewBox();
  }, [applyViewBox, halfW, halfH]);

  /** Coalesce viewBox writes to at most one per animation frame. */
  const scheduleViewBox = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      applyViewBox();
    });
  }, [applyViewBox]);

  /** Screen pixels per board unit at the current zoom (reads layout — call once per gesture). */
  const pxPerBoard = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? rect.width / ((2 * extentRef.current.halfW) / zoomRef.current) : 1;
  };

  /** Stop an in-flight focus animation (any manual pan/zoom wins). */
  const cancelAnim = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      cancelAnim();
      zoomRef.current = clamp(zoomRef.current * factor, MIN_ZOOM, MAX_ZOOM);
      scheduleViewBox();
      markDirty(true);
    },
    [scheduleViewBox, cancelAnim, markDirty]
  );

  const reset = useCallback(() => {
    cancelAnim();
    zoomRef.current = 1;
    centerRef.current = { x: 0, y: 0 };
    savedViewRef.current = null;
    applyViewBox();
    markDirty(false);
  }, [applyViewBox, cancelAnim, markDirty]);

  /** Ease the view to `point` at `zoom` over FOCUS_DURATION_MS. */
  const animateTo = useCallback(
    (point: { x: number; y: number }, zoom: number) => {
      cancelAnim();
      const fromZoom = zoomRef.current;
      const toZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      const from = { ...centerRef.current };
      const start = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / FOCUS_DURATION_MS);
        const k = ease(t);
        // Interpolate zoom geometrically so the scale change feels uniform;
        // the last frame lands exactly on the target (the formula can come
        // out a hair under it, e.g. 3.9999999999999996, and miss thresholds).
        zoomRef.current = t < 1 ? fromZoom * Math.pow(toZoom / fromZoom, k) : toZoom;
        centerRef.current = t < 1 ? { x: from.x + (point.x - from.x) * k, y: from.y + (point.y - from.y) * k } : { ...point };
        applyViewBox();
        animRef.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [applyViewBox, cancelAnim]
  );

  /**
   * Smoothly move the view to center `point` (board coordinates) at `zoom`
   * (never zooming out: the current zoom is kept if it is already closer).
   * The view before the first focus is remembered so `restoreView` can return
   * to it; focusing again (another selection) keeps that original view.
   */
  const focusOn = useCallback(
    (point: { x: number; y: number }, zoom: number) => {
      if (!savedViewRef.current) {
        savedViewRef.current = { zoom: zoomRef.current, center: { ...centerRef.current }, dirty: dirtyRef.current };
      }
      animateTo(point, Math.max(zoomRef.current, zoom));
      markDirty(true);
    },
    [animateTo, markDirty]
  );

  /** Glide back to the view from before the first `focusOn` (no-op if none). */
  const restoreView = useCallback(() => {
    const saved = savedViewRef.current;
    if (!saved) return;
    savedViewRef.current = null;
    animateTo(saved.center, saved.zoom);
    markDirty(saved.dirty);
  }, [animateTo, markDirty]);

  /** Glide to the full-board view (zoom 1, centered) — e.g. picking a hex
      while moving the robber needs every target on screen at once. */
  const fitView = useCallback(() => {
    animateTo({ x: 0, y: 0 }, 1);
    markDirty(false);
  }, [animateTo, markDirty]);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) reset();
      else zoomBy(ZOOM_STEP);
    },
    [reset, zoomBy]
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Pressing a draggable piece (soldier, robber) starts a piece drag via
    // pointerdown — the real mousedown still fires and must not arm a pan.
    if (touchesDragHandle(e.target)) return;
    panRef.current = beginPan(e, centerRef.current.x, centerRef.current.y);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      if (!pan.active) {
        if (Math.hypot(e.clientX - pan.startX, e.clientY - pan.startY) < PAN_THRESHOLD) return;
        pan.active = true;
        // A real pan takes over from any focus animation; rebase on the
        // animated center so the board doesn't jump.
        cancelAnim();
        pan.originX = centerRef.current.x;
        pan.originY = centerRef.current.y;
        pan.startX = e.clientX;
        pan.startY = e.clientY;
        pan.scale = pxPerBoard();
      }
      centerRef.current = {
        x: pan.originX - (e.clientX - pan.startX) / pan.scale,
        y: pan.originY - (e.clientY - pan.startY) / pan.scale,
      };
      scheduleViewBox();
      markDirty(true);
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
    // Touch: one finger pans (mirrors the mouse pan); two fingers pinch
    // zoom, midpoint-anchored. `touch-action: none` on the svg (see
    // BoardView) is the primary guard against page scroll; the non-passive
    // touchmove listener's preventDefault() is the second. A plain tap
    // still produces a click (only touchstart's preventDefault would kill
    // it, so touchstart stays passive).
    //
    // Drag handles: a touch starting on a draggable piece (soldier, robber)
    // is a piece drag, not a pan — and if a drag is already live, a second
    // finger must not turn it into a pinch.
    const beginTouchPan = (t: Touch) => {
       panRef.current = beginPan(t, centerRef.current.x, centerRef.current.y);
    };
    const onTouchStart = (e: TouchEvent) => {
       if (e.touches.length === 2) {
         if (dragRef.current) {
           // A piece drag is live (or just started on a handle): suppress the
           // pinch instead of fighting the drag for the board's view.
           pinchRef.current = null;
           panRef.current = null;
           return;
         }
         panRef.current = null; // pinch takes priority; suppress the single-finger pan
         pinchRef.current = beginPinch(e.touches[0], e.touches[1], centerRef.current, zoomRef.current);
       } else if (e.touches.length === 1) {
         pinchRef.current = null;
         const onHandle = touchesDragHandle(e.target);
         dragRef.current = dragRef.current || onHandle;
         if (onHandle) {
           panRef.current = null;
         } else {
           beginTouchPan(e.touches[0]);
         }
       }
    };
    const onTouchMove = (e: TouchEvent) => {
       const pinch = pinchRef.current;
       if (e.touches.length === 2 && pinch) {
         e.preventDefault();
         const a = e.touches[0];
         const b = e.touches[1];
         const rect = svgRef.current?.getBoundingClientRect();
         if (!rect || rect.width <= 0) return;
         cancelAnim();
         const next = pinchStep(
           pinch,
           a,
           b,
           rect,
           extentRef.current.halfW,
           PINCH_MIN_DIST,
           MIN_ZOOM,
           MAX_ZOOM
         );
         if (!next) return;
         pinchRef.current = next.pinch;
         zoomRef.current = next.zoom;
         centerRef.current = next.center;
         scheduleViewBox();
         markDirty(true);
       } else if (e.touches.length === 1) {
         const t = e.touches[0];
         const pan = panRef.current;
         if (!pan) return;
         e.preventDefault();
         const wasActive = pan.active;
         const next = panStep(pan, t, PAN_THRESHOLD, centerRef.current, pxPerBoard);
         if (!next) return;
         if (!wasActive && next.pan.active) cancelAnim(); // pan just took over from a focus animation
         panRef.current = next.pan;
         centerRef.current = next.center;
         scheduleViewBox();
         markDirty(true);
       }
    };
    const onTouchEnd = (e: TouchEvent) => {
       if (e.touches.length === 0) {
         panRef.current = null;
         pinchRef.current = null;
         dragRef.current = false;
       } else if (e.touches.length === 1) {
         if (dragRef.current) return; // a finger lifted mid piece-drag: no pan
         // Finger lifted mid-pinch: keep panning with the last finger
         // (re-base so the board doesn't jump).
         pinchRef.current = null;
         beginTouchPan(e.touches[0]);
       }
    };
    if (svg) {
       svg.addEventListener('touchstart', onTouchStart);
       svg.addEventListener('touchmove', onTouchMove, { passive: false });
       svg.addEventListener('touchend', onTouchEnd);
       svg.addEventListener('touchcancel', onTouchEnd);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (svg) svg.removeEventListener('wheel', onWheel);
      if (svg) {
        svg.removeEventListener('touchstart', onTouchStart);
        svg.removeEventListener('touchmove', onTouchMove);
        svg.removeEventListener('touchend', onTouchEnd);
        svg.removeEventListener('touchcancel', onTouchEnd);
      }
      cancelAnim();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // pxPerBoard reads zoomRef/extentRef (always current); zoomBy is a stable
    // callback. Re-runs only if the svg element changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRef, zoomBy, scheduleViewBox, cancelAnim, markDirty]);

  return {
    reset,
    isDirty,
    /** True at or above DETAIL_ZOOM_IN; otherwise render count badges. */
    detailed,
    // Starting viewBox; after mount the attribute is driven imperatively and
    // re-applied on resize by the effect above.
    viewBox: `${-halfW} ${-halfH} ${2 * halfW} ${2 * halfH}`,
    onDoubleClick,
    focusOn,
    restoreView,
    fitView,
    onMouseDown,
  };
}
