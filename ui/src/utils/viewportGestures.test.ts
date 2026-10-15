import { describe, expect, it } from 'vitest';
import {
  beginPan,
  beginPinch,
  panStep,
  pinchStep,
  touchesDragHandle,
  DRAG_HANDLE_SELECTOR,
} from './viewportGestures';

const CENTER = { x: 0, y: 0 };
const RECT = { left: 0, top: 0, width: 800, height: 600 };
const HALF_W = 400; // board half-width in board units at zoom 1

describe('panStep', () => {
  it('returns null inside the dead zone', () => {
    const pan = beginPan({ clientX: 100, clientY: 100 }, 0, 0);
    const out = panStep(pan, { clientX: 102, clientY: 102 }, 4, CENTER, () => 2);
    expect(out).toBeNull();
  });

  it('activates past the dead zone and re-bases on the live center', () => {
    const pan = beginPan({ clientX: 100, clientY: 100 }, 0, 0);
    // Live center moved (a focus animation was mid-flight).
    const live = { x: 50, y: -20 };
    const out = panStep(pan, { clientX: 110, clientY: 100 }, 4, live, () => 2);
    expect(out).not.toBeNull();
    expect(out!.pan.active).toBe(true);
    // Activation anchors the board under the finger at the live center —
    // the board must not jump when the drag engages.
    expect(out!.center).toEqual(live);
    expect(out!.pan.scale).toBe(2);
  });

  it('moves the center opposite the finger in board units', () => {
    let pan = beginPan({ clientX: 0, clientY: 0 }, 0, 0);
    const first = panStep(pan, { clientX: 10, clientY: 0 }, 4, CENTER, () => 2)!;
    pan = first.pan;
    const out = panStep(pan, { clientX: 30, clientY: 0 }, 4, CENTER, () => 2)!;
    // Moved 20px right at 2px/unit → center shifts 10 units left.
    expect(out.center.x).toBeCloseTo(-10);
    expect(out.center.y).toBeCloseTo(0);
  });
});

describe('pinchStep', () => {
  const pinch = (dist: number, zoom = 1) => ({
    dist,
    originX: 0,
    originY: 0,
    zoom,
  });

  it('doubles zoom when the finger distance doubles', () => {
    const g = beginPinch({ clientX: 300, clientY: 300 }, { clientX: 500, clientY: 300 }, CENTER, 1);
    const out = pinchStep(g, { clientX: 200, clientY: 300 }, { clientX: 600, clientY: 300 }, RECT, HALF_W, 12, 1, 8)!;
    expect(out.zoom).toBeCloseTo(2);
  });

  it('keeps the board point under the midpoint pinned', () => {
    // Pinch centered at (400,300) — screen center → board center stays at 0,0.
    const g = beginPinch({ clientX: 300, clientY: 300 }, { clientX: 500, clientY: 300 }, CENTER, 1);
    const out = pinchStep(g, { clientX: 200, clientY: 300 }, { clientX: 600, clientY: 300 }, RECT, HALF_W, 12, 1, 8)!;
    expect(out.center.x).toBeCloseTo(0);
    expect(out.center.y).toBeCloseTo(0);
  });

  it('recenters when the midpoint moves off center', () => {
    const g = beginPinch({ clientX: 200, clientY: 200 }, { clientX: 400, clientY: 200 }, CENTER, 1);
    const out = pinchStep(g, { clientX: 100, clientY: 200 }, { clientX: 500, clientY: 200 }, RECT, HALF_W, 12, 1, 8)!;
    // Midpoint moved left of screen center → the board pans right.
    expect(out.center.x).toBeLessThan(0);
  });

  it('clamps to the zoom bounds', () => {
    const g = pinch(200, 7.9);
    const out = pinchStep(g, { clientX: 0, clientY: 0 }, { clientX: 900, clientY: 0 }, RECT, HALF_W, 12, 1, 8)!;
    expect(out.zoom).toBe(8);
  });

  it('returns null below the minimum finger distance', () => {
    const g = pinch(5);
    const out = pinchStep(g, { clientX: 0, clientY: 0 }, { clientX: 4, clientY: 0 }, RECT, HALF_W, 12, 1, 8);
    expect(out).toBeNull();
  });
});

describe('touchesDragHandle', () => {
  it('detects a drag handle and its descendants', () => {
    document.body.innerHTML = `
      <svg><g ${DRAG_HANDLE_SELECTOR.slice(1, -1)}><circle id="inner"/></g><circle id="plain"/></svg>`;
    const inner = document.getElementById('inner')!;
    const plain = document.getElementById('plain')!;
    expect(touchesDragHandle(inner)).toBe(true);
    expect(touchesDragHandle(plain)).toBe(false);
  });

  it('is false for non-element targets', () => {
    expect(touchesDragHandle(null)).toBe(false);
    expect(touchesDragHandle(document)).toBe(false);
  });
});
