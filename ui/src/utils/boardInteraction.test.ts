import { describe, expect, it } from 'vitest';
import { nearestWithin } from './boardInteraction';
import type { Board } from 'common';

/** Minimal board: three vertices in a row, edges A-B (road) and B-C (no road). */
const board = {
  vertices: {
    A: { id: 'A', position: { x: 0, y: 0 }, roadIds: ['AB'], hexIds: [] },
    B: { id: 'B', position: { x: 60, y: 0 }, roadIds: ['AB', 'BC'], hexIds: [] },
    C: { id: 'C', position: { x: 120, y: 0 }, roadIds: ['BC'], hexIds: [] },
  },
  edges: {
    AB: { id: 'AB', vertexAId: 'A', vertexBId: 'B', roadId: 'r1' },
    BC: { id: 'BC', vertexAId: 'B', vertexBId: 'C', roadId: null },
  },
  hexes: {},
  soldiers: {},
} as unknown as Board;

describe('nearestWithin (drop resolution)', () => {
  const ids = ['A', 'B', 'C'];
  const at = (id: string) => board.vertices[id]?.position ?? null;

  it('picks the nearest vertex inside the threshold', () => {
    // Finger lands 10 units from B; A is 50, C is 70.
    expect(nearestWithin(ids, { x: 50, y: 0 }, 30, at)).toBe('B');
  });

  it('returns null when nothing is inside the threshold (silent cancel)', () => {
    expect(nearestWithin(ids, { x: 30, y: 200 }, 30, at)).toBeNull();
  });

  it('skips items whose position resolves to null', () => {
    const withStale = [...ids, 'GHOST'];
    expect(nearestWithin(withStale, { x: 5, y: 0 }, 30, at)).toBe('A');
  });

  it('empty target list yields null (no valid roads)', () => {
    expect(nearestWithin([], { x: 0, y: 0 }, 30, at)).toBeNull();
  });
});
