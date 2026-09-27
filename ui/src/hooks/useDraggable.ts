import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadPanelLayout, savePanelLayout } from '../utils/panelLayout';
import { DRAG_THRESHOLD, RESET_PANELS_EVENT } from '../constants';
import { UseDraggableOptions, UseDraggableResult } from '../types/draggablePanel';

/**
 * Drag/position state for a floating panel (see DraggablePanel): measuring,
 * home-rect placement, persisted layout, pointer dragging, corner resizing,
 * collapse state, and reset handling. Returns the refs and handlers the
 * panel's markup needs.
 */
export function useDraggable({
  id,
  minWidth,
  minHeight,
  layout,
  onMeasure,
  followContent = false,
}: UseDraggableOptions): UseDraggableResult {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);
  const onMeasureRef = useRef(onMeasure);
  onMeasureRef.current = onMeasure;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const savedRef = useRef(id ? loadPanelLayout(id) : null);
  const naturalRef = useRef<{ w: number; h: number } | null>(null);
  const measuredOnceRef = useRef(false);
  const userMovedRef = useRef(false);
  const resetPendingRef = useRef(false);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const contentRef = useRef<HTMLDivElement>(null);
  /** Panel chrome (padding + header row), constant; see the content-follower. */
  const chromeRef = useRef(0);
  /** Once the user resizes, the panel keeps the user's size (no auto-height). */
  const userResizedRef = useRef(false);
  /** State mirror of `userResizedRef` so the render can react to a resize. */
  const [userResized, setUserResized] = useState(false);
  /** Last height reported to the parent (dedup for the content-follower). */
  const lastReportedHRef = useRef(0);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resetTick, setResetTick] = useState(0);

  /** Measure the panel's natural size (it must be at auto size at the origin). */
  const measure = () => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    naturalRef.current = { w: r.width, h: r.height };
    onMeasureRef.current?.({ w: r.width, h: r.height });
  };

  // First mount: measure while hidden at the origin.
  useLayoutEffect(() => {
    if (measuredOnceRef.current) return;
    measuredOnceRef.current = true;
    measure();
    // The panel is at auto size here: chrome = natural height minus the
    // content's natural height (padding + header row).
    if (naturalRef.current && contentRef.current) {
      chromeRef.current = naturalRef.current.h - contentRef.current.offsetHeight;
    }
  }, []);

  // Place the panel: at its saved layout (if any), else at its home rect.
  // Re-runs when the home rect changes (window resize) or after a reset.
  useLayoutEffect(() => {
    const l = layoutRef.current;
    if (!l || !naturalRef.current) return;
    if (userMovedRef.current) return; // keep the user's position/size
    const n = naturalRef.current;
    if (resetPendingRef.current) {
      // The panel was just returned to auto size at the origin: re-measure.
      resetPendingRef.current = false;
      measure();
    }
    const s = savedRef.current;
    if (s && (s.pos || s.size)) {
      setPos(s.pos ?? { x: l.x, y: l.y });
      setSize(s.size ?? { w: l.w ?? n.w, h: l.h ?? n.h });
    } else {
      setPos({ x: l.x, y: l.y });
      setSize({ w: l.w ?? n.w, h: l.h ?? n.h });
    }
  }, [layout, resetTick]);

  // Persist the position/size to sessionStorage. Only user-moved panels are
  // saved, so un-moved panels keep following their home rect on window
  // resize (a stale saved home would otherwise be re-applied).
  useEffect(() => {
    if (!id || !pos || !userMovedRef.current) return;
    savePanelLayout(id, { pos, size: size ?? null });
  }, [id, pos, size]);
  // Auto-height (`followContent` panels): the panel is always sized to its
  // content (no explicit height cap), so the content is never clipped. When
  // the content grows or shrinks, report the new height so the parent's
  // stack follows. Stops once the user resizes (which pins the height).
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !followContent) return;
    const ro = new ResizeObserver(() => {
      if (collapsed || userResizedRef.current) return;
      const s = sizeRef.current;
      if (!s) return;
      const naturalH = el.offsetHeight + chromeRef.current;
      if (Math.abs(lastReportedHRef.current - naturalH) < 1) return;
      lastReportedHRef.current = naturalH;
      onMeasureRef.current?.({ w: s.w, h: naturalH });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [followContent, collapsed]);

  // Reset: clear the saved layout, return to auto size at the origin; the
  // placement effect re-measures and places the panel at its home rect.
  useEffect(() => {
    const onReset = () => {
      userMovedRef.current = false;
      userResizedRef.current = false;
      savedRef.current = null;
      resetPendingRef.current = true;
      if (id) savePanelLayout(id, { pos: null, size: null });
      setPos(null);
      setSize(null);
      setCollapsed(false);
      setUserResized(false);
      lastReportedHRef.current = 0;
      setResetTick((t) => t + 1);
    };
    window.addEventListener(RESET_PANELS_EVENT, onReset);
    return () => window.removeEventListener(RESET_PANELS_EVENT, onReset);
  }, [id]);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) {
        // Ignore small jitters so a click on the grip doesn't move the panel.
        if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD && Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragRef.current = true;
        userMovedRef.current = true;
        const el = panelRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          setPos({ x: rect.left, y: rect.top });
          setSize({ w: Math.max(minWidth, rect.width), h: Math.max(minHeight, rect.height) });
        }
        return;
      }
      setPos((p) => (p ? { x: p.x + ev.movementX, y: p.y + ev.movementY } : p));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    userMovedRef.current = true;
    userResizedRef.current = true;
    setUserResized(true);
    const startX = e.clientX;
    const startY = e.clientY;
    // Read the actual rendered size: for auto-height panels `size.h` is a
    // stale snapshot, so the live DOM rect is the source of truth.
    const rect = panelRef.current?.getBoundingClientRect();
    const startSize = {
      w: rect ? rect.width : (size?.w ?? minWidth),
      h: rect ? rect.height : (size?.h ?? minHeight),
    };
    const startPos = pos ?? { x: 0, y: 0 };
    // Top-right handle: the bottom-left corner is fixed and the top edge
    // follows the cursor (the handle sits on the top edge).
    const bottom = startPos.y + startSize.h;

    const onMove = (ev: PointerEvent) => {
      const w = Math.max(minWidth, startSize.w + (ev.clientX - startX));
      const h = Math.max(minHeight, startSize.h - (ev.clientY - startY));
      setPos({ x: startPos.x, y: bottom - h });
      setSize({ w, h });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return {
    panelRef,
    contentRef,
    pos,
    size,
    collapsed,
    setCollapsed,
    dragging,
    placed: pos !== null,
    userResized,
    startDrag,
    startResize,
  };
}
