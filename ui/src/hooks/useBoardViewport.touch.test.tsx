import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { useBoardViewport } from './useBoardViewport';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const RECT = { left: 0, top: 0, width: 800, height: 600 };

/** Minimal host: a full-size svg driven by the viewport hook. */
function TestBoard({ dragRef }: { dragRef: React.MutableRefObject<boolean> }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const viewport = useBoardViewport(svgRef, 800, { w: 800, h: 600 }, dragRef);
  return (
    <svg ref={svgRef} width="800" height="600" viewBox={viewport.viewBox} onMouseDown={viewport.onMouseDown}>
      {/* a draggable piece + an empty area to hit */}
      <g data-drag-handle="true" id="handle">
        <rect x="0" y="0" width="10" height="10" />
      </g>
      <rect id="empty" x="20" y="20" width="10" height="10" />
    </svg>
  );
}

function touch(x: number, y: number) {
  return { clientX: x, clientY: y };
}

function dispatchTouch(target: Element, type: string, touches: { clientX: number; clientY: number }[]) {
  // Dispatch on the element the finger touched; the event bubbles to the
  // svg listener with `target` set correctly (dispatchEvent owns `target`).
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'touches', { value: touches.map((t) => ({ ...t, target })) });
  target.dispatchEvent(ev);
}

describe('useBoardViewport touch paths', () => {
  let container: HTMLElement;
  let root: Root;
  let svg: SVGSVGElement;
  let empty: Element;
  let handle: Element;
  let dragRef: React.MutableRefObject<boolean>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dragRef = { current: false } as React.MutableRefObject<boolean>;
    act(() => {
      root = createRoot(container);
      root.render(<TestBoard dragRef={dragRef} />);
    });
    svg = container.querySelector('svg')!;
    empty = container.querySelector('#empty')!;
    handle = container.querySelector('#handle')!;
    svg.getBoundingClientRect = () => ({ ...RECT, x: 0, y: 0, right: 800, bottom: 600 }) as DOMRect;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const viewBox = () => svg.getAttribute('viewBox')!;

  /** viewBox writes are coalesced through requestAnimationFrame — flush one frame. */
  const frame = () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 25);
    return act(async () => {
      await promise;
    });
  };

  it('a touch drag on empty space pans the viewBox', async () => {
    const start = viewBox();
    dispatchTouch(empty, 'touchstart', [touch(400, 300)]);
    dispatchTouch(empty, 'touchmove', [touch(440, 300)]); // activates past the dead zone
    dispatchTouch(empty, 'touchmove', [touch(480, 300)]); // actually moves the board
    await frame();
    expect(viewBox()).not.toBe(start);
  });

  it('a touch starting on a drag handle does not pan', async () => {
    const start = viewBox();
    dispatchTouch(handle, 'touchstart', [touch(400, 300)]);
    dispatchTouch(handle, 'touchmove', [touch(440, 300)]);
    dispatchTouch(handle, 'touchmove', [touch(480, 300)]);
    dispatchTouch(handle, 'touchend', []);
    await frame();
    expect(viewBox()).toBe(start);
  });

  it('a second finger arriving mid piece-drag does not pinch', async () => {
    dragRef.current = true; // a drag is already live
    const start = viewBox();
    dispatchTouch(empty, 'touchstart', [touch(400, 300)]);
    dispatchTouch(empty, 'touchstart', [touch(400, 300), touch(500, 300)]);
    dispatchTouch(empty, 'touchmove', [touch(300, 300), touch(600, 300)]);
    await frame();
    expect(viewBox()).toBe(start);
  });

  it('pinch with two fingers zooms (viewBox shrinks)', async () => {
    const start = viewBox();
    dispatchTouch(empty, 'touchstart', [touch(300, 300), touch(500, 300)]);
    dispatchTouch(empty, 'touchmove', [touch(200, 300), touch(600, 300)]);
    await frame();
    const [, , w, h] = viewBox().split(' ').map(Number);
    const [, , ow, oh] = start.split(' ').map(Number);
    expect(w).toBeLessThan(ow); // zoomed in: the window over the board shrinks
    expect(h).toBeLessThan(oh);
  });

  it('a finger lifting mid-drag does not re-arm a pan', async () => {
    dispatchTouch(empty, 'touchstart', [touch(300, 300), touch(500, 300)]); // two fingers = pinch
    // Simulate: drag became live mid-pinch (a piece was grabbed), one finger lifts.
    dragRef.current = true;
    const start = viewBox();
    dispatchTouch(empty, 'touchend', [touch(400, 300)]);
    dispatchTouch(empty, 'touchmove', [touch(460, 300)]);
    await frame();
    expect(viewBox()).toBe(start);
  });

  it('mousedown on a drag handle does not arm a mouse pan', async () => {
    const ev = new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100, clientY: 100 });
    act(() => handle.dispatchEvent(ev));
    const start = viewBox();
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 140, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('mouseup', {}));
    });
    await frame();
    expect(viewBox()).toBe(start);
  });
});
