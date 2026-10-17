import { describe, expect, it } from 'vitest';
import { soldierMoveTargets } from './selectors';
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

describe('soldierMoveTargets', () => {
  it('only road-connected vertices are valid targets', () => {
    expect(soldierMoveTargets(board, 'A')).toEqual(['B']);
    // B connects by road to A only — BC has no road.
    expect(soldierMoveTargets(board, 'B')).toEqual(['A']);
    expect(soldierMoveTargets(board, 'C')).toEqual([]);
  });
});
