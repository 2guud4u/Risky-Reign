import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import type { BoardUIState, BoardVertex, BoardEdge } from 'common';
import BuildAnimationLayer from './BuildAnimationLayer';
import { usePieceHidden } from './buildFx';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const vertex = (id: string, over: Partial<BoardVertex> = {}): BoardVertex =>
  ({
    id,
    position: { x: 100, y: 200 },
    hasSettlement: false,
    settlementLevel: 'none',
    settlementOwnerId: null,
    ...over,
  }) as BoardVertex;

const edge = (id: string, over: Partial<BoardEdge> = {}): BoardEdge =>
  ({
    id,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 50 },
    hasRoad: false,
    roadOwnerId: null,
    ...over,
  }) as BoardEdge;

const state = (
  vertices: Record<string, BoardVertex>,
  edges: Record<string, BoardEdge> = {}
): BoardUIState => ({ vertices, edges, hexes: {} }) as BoardUIState;

const colorOf = () => '#e6194b';

/** A BoardVertex stand-in reading the same suppression flag the real one does. */
function ProbeVertex({ id }: { id: string }) {
  const hidden = usePieceHidden(id);
  return <g data-vertex-id={id}>{hidden ? null : <image data-probe="visible" />}</g>;
}

function Harness({ base }: { base: BoardUIState }) {
  return (
    <svg>
      <ProbeVertex id="A" />
      <BuildAnimationLayer base={base} colorOf={colorOf} />
    </svg>
  );
}

describe('BuildAnimationLayer', () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = (base: BoardUIState) => act(() => root.render(<Harness base={base} />));

  it('plays the settlement pop on a new settlement and releases the claim', async () => {
    render(state({ A: vertex('A') }));
    // The probe always draws its own image when not suppressed.
    expect(document.querySelector('[data-probe]')).not.toBeNull();
    // Upgrade state: vertex gains a settlement
    render(
      state({ A: vertex('A', { hasSettlement: true, settlementLevel: 'settlement', settlementOwnerId: 'me' }) })
    );
    // The probe's piece is suppressed while the pop plays.
    expect(document.querySelector('[data-probe]')).toBeNull();
    // The anim layer mounts a stand-in group for the pop.
    const animGroups = container.querySelectorAll('svg > g[style*="transform"], svg g[style*="transform"]');
    expect(animGroups.length).toBeGreaterThan(0);
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(document.querySelector('[data-vertex-id=A] image')).not.toBeNull();
  });

  it('plays smoke + pop for a city upgrade', async () => {
    render(state({ A: vertex('A', { hasSettlement: true, settlementLevel: 'settlement' }) }));
    render(state({ A: vertex('A', { hasSettlement: true, settlementLevel: 'city' }) }));
    expect(document.querySelector('[data-vertex-id=A] image')).toBeNull();
    // Smoke puffs render as circles (framer may not keep data attrs, so count circles).
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(document.querySelector('[data-vertex-id=A] image')).not.toBeNull();
  });

  it('plays the road grow on a new road', async () => {
    render(state({}, { E: edge('E') }));
    render(state({}, { E: edge('E', { hasRoad: true, roadOwnerId: 'me' }) }));
    const line = container.querySelector('line[stroke-dasharray]');
    expect(line).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(container.querySelector('line[stroke-dasharray]')).toBeNull();
  });

  it('keeps the claim alive across a child remount (StrictMode probe)', async () => {
    render(state({ A: vertex('A') }));
    render(
      state({ A: vertex('A', { hasSettlement: true, settlementLevel: 'settlement', settlementOwnerId: 'me' }) })
    );
    // Simulate an early unmount of the anim child: the claim must NOT release
    // before the duration elapses (regression: cleanup-time release = no anim).
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(document.querySelector('[data-vertex-id=A] image')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(document.querySelector('[data-vertex-id=A] image')).not.toBeNull();
  });
});
