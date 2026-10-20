import { describe, expect, it } from 'vitest';
import type { BoardUIState, BoardVertex, BoardEdge } from 'common';
import { diffBuilds } from './buildDiff';

/** Minimal presentation vertex/edge: only the fields diffBuilds reads. */
const vertex = (over: Partial<BoardVertex>): BoardVertex =>
  ({ position: { x: 0, y: 0 }, hasSettlement: false, settlementLevel: 'none', settlementOwnerId: null, ...over }) as BoardVertex;
const edge = (over: Partial<BoardEdge>): BoardEdge =>
  ({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, hasRoad: false, roadOwnerId: null, ...over }) as BoardEdge;

const state = (
  vertices: Record<string, BoardVertex>,
  edges: Record<string, BoardEdge>
): BoardUIState => ({ vertices, edges, hexes: {} }) as BoardUIState;

describe('diffBuilds', () => {
  it('returns nothing on the first snapshot (join/rejoin baseline)', () => {
    const next = state({ A: vertex({ hasSettlement: true, settlementLevel: 'city' }) }, {});
    expect(diffBuilds(null, next)).toEqual([]);
  });

  it('detects a new settlement', () => {
    const prev = state({ A: vertex({}) }, {});
    const next = state(
      { A: vertex({ hasSettlement: true, settlementLevel: 'settlement', settlementOwnerId: 'me' }) },
      {}
    );
    expect(diffBuilds(prev, next)).toEqual([{ kind: 'settlement', id: 'A' }]);
  });

  it('detects a settlement→city upgrade', () => {
    const before = vertex({ hasSettlement: true, settlementLevel: 'settlement' });
    const after = vertex({ hasSettlement: true, settlementLevel: 'city' });
    expect(diffBuilds(state({ A: before }, {}), state({ A: after }, {}))).toEqual([
      { kind: 'city', id: 'A' },
    ]);
  });

  it('detects a new road', () => {
    const prev = state({}, { E: edge({}) });
    const next = state({}, { E: edge({ hasRoad: true, roadOwnerId: 'me' }) });
    expect(diffBuilds(prev, next)).toEqual([{ kind: 'road', id: 'E' }]);
  });

  it('ignores unchanged and torn-down pieces', () => {
    const prev = state(
      { A: vertex({ hasSettlement: true, settlementLevel: 'city' }), B: vertex({}) },
      { E: edge({ hasRoad: true }) }
    );
    const next = state(
      { A: vertex({ hasSettlement: true, settlementLevel: 'city' }), B: vertex({}) },
      { E: edge({ hasRoad: false }) }
    );
    expect(diffBuilds(prev, next)).toEqual([]);
  });

  it('reports several changes from one broadcast', () => {
    const prev = state({ A: vertex({}) }, { E: edge({}) });
    const next = state(
      { A: vertex({ hasSettlement: true, settlementLevel: 'settlement' }) },
      { E: edge({ hasRoad: true }) }
    );
    expect(diffBuilds(prev, next)).toEqual([
      { kind: 'settlement', id: 'A' },
      { kind: 'road', id: 'E' },
    ]);
  });
});
