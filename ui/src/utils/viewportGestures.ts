import { PixelCoord } from 'common';

/**
 * Pure gesture math for the board viewport, extracted for testability.
 * `useBoardViewport` adapts native TouchEvents into these shapes and applies
 * the returned view state to its refs; nothing here touches the DOM.
 */

export interface GestureTouch {
  clientX: number;
  clientY: number;
}

/** State carried between moves of one pan gesture. */
export interface PanGesture {
  /** Screen point where the pan (or its last activation) started. */
  startX: number;
  startY: number;
  /** Board-space center when the pan activated. */
  originX: number;
  originY: number;
  /** Whether the drag has passed the dead-zone threshold yet. */
  active: boolean;
  /** Screen px per board unit, measured when the pan activates. */
  scale: number;
}

/** State carried between moves of one pinch gesture. */
export interface PinchGesture {
  /** Finger distance at the previous move. */
  dist: number;
  /** Board-space center at the previous move. */
  originX: number;
  originY: number;
  /** Zoom at the previous move. */
  zoom: number;
}

/** Screen-space geometry needed to keep the pinch midpoint pinned. */
export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Begin (or re-base) a one-finger pan. Re-basing on the live center/zoom
 * when the pan crosses the dead-zone keeps the board glued to the finger —
 * no jump when a focus animation was mid-flight.
 */
export function beginPan(t: GestureTouch, originX: number, originY: number): PanGesture {
  return { startX: t.clientX, startY: t.clientY, originX, originY, active: false, scale: 1 };
}

/**
 * Advance a pan. Returns null while the finger is still inside the dead
 * zone; on the first move past it, re-bases the origin so the board doesn't
 * jump. `pxPerBoard` is only read at activation (zoom can't change mid-pan).
 */
export function panStep(
  pan: PanGesture,
  t: GestureTouch,
  deadZone: number,
  liveCenter: PixelCoord,
  pxPerBoard: () => number
): { pan: PanGesture; center: PixelCoord } | null {
  if (!pan.active) {
    if (Math.hypot(t.clientX - pan.startX, t.clientY - pan.startY) < deadZone) return null;
    return {
      pan: { startX: t.clientX, startY: t.clientY, originX: liveCenter.x, originY: liveCenter.y, active: true, scale: pxPerBoard() },
      center: { x: liveCenter.x, y: liveCenter.y },
    };
  }
  return {
    pan,
    center: {
      x: pan.originX - (t.clientX - pan.startX) / pan.scale,
      y: pan.originY - (t.clientY - pan.startY) / pan.scale,
    },
  };
}

/** Begin a two-finger pinch: distance + center/zoom captured at gesture start. */
export function beginPinch(a: GestureTouch, b: GestureTouch, center: PixelCoord, zoom: number): PinchGesture {
  return { dist: touchDist(a, b), originX: center.x, originY: center.y, zoom };
}

export const touchDist = (a: GestureTouch, b: GestureTouch): number =>
  Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

/**
 * Advance a pinch. Zoom is a ratio on finger distance, clamped; the board
 * point under the midpoint stays pinned to the new midpoint (read off at the
 * previous zoom, written back at the new one). Returns null below the
 * minimum finger distance (noise floor).
 */
export function pinchStep(
  pinch: PinchGesture,
  a: GestureTouch,
  b: GestureTouch,
  rect: ViewportRect,
  halfW: number,
  minDist: number,
  minZoom: number,
  maxZoom: number
): { pinch: PinchGesture; zoom: number; center: PixelCoord } | null {
  const dist = touchDist(a, b);
  if (dist < minDist || pinch.dist < minDist) return null;
  const zoom = Math.min(maxZoom, Math.max(minZoom, pinch.zoom * (dist / pinch.dist)));
  const pxPrev = rect.width / ((2 * halfW) / pinch.zoom);
  const pxNew = rect.width / ((2 * halfW) / zoom);
  const offX = (a.clientX + b.clientX) / 2 - rect.left - rect.width / 2;
  const offY = (a.clientY + b.clientY) / 2 - rect.top - rect.height / 2;
  const boardX = pinch.originX + offX / pxPrev;
  const boardY = pinch.originY + offY / pxPrev;
  const center = { x: boardX - offX / pxNew, y: boardY - offY / pxNew };
  return {
    pinch: { dist, originX: center.x, originY: center.y, zoom },
    zoom,
    center,
  };
}

/**
 * True when a touch sequence started on an interactive drag handle
 * (soldier badge/sprite, robber) — a one-finger drag there is a piece drag,
 * not a pan, and a second finger must not turn it into a pinch.
 */
export const DRAG_HANDLE_SELECTOR = '[data-drag-handle]';

export function touchesDragHandle(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(DRAG_HANDLE_SELECTOR) !== null;
}
