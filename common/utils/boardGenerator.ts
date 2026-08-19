/**
 * Board generation. Pure: given a hex layout (coords + terrain + tokens) it
 * produces a complete domain Board with canonical string ids.
 *
 * Golden reference (standard radius-2 board):
 *   19 hexes, 54 vertices, 72 edges.
 * Vertex hex-neighbour distribution: 18x1-hex (boundary), 12x2-hex, 24x3-hex.
 * Edge hex-neighbour distribution:   30x1-hex (boundary), 42x2-hex.
 */

import {
  Board,
  EdgeId,
  EdgeNode,
  HexId,
  HexNode,
  VertexId,
  VertexNode,
} from '../types/Board';
import { CubeCoord, hexId as toHexId } from '../types/Coordinates';
import { assignStandardHexes } from '../types/Hex';
import { computeAdjacency } from './adjacency';

export interface HexLayout {
  coord: CubeCoord;
  terrain: string;
  rollNumber: number | null;
}

/**
 * Build a domain Board from an arbitrary hex layout.
 * @param layouts - one entry per hex (coord + terrain + token)
 * @param options - hex size for pixel projection and metadata
 */
export function generateBoard(
  layouts: HexLayout[],
  options: { id?: string; generator?: string; hexSize?: number } = {}
): Board {
  const hexSize = options.hexSize ?? 50;
  const coords = layouts.map((l) => l.coord);

  const hexes: Record<HexId, HexNode> = {};
  for (const l of layouts) {
    const id = toHexId(l.coord);
    hexes[id] = {
      id,
      coord: l.coord,
      terrain: l.terrain,
      rollNumber: l.rollNumber,
      robber: l.terrain === 'Desert',
    };
  }

  const g = computeAdjacency(coords, hexSize);

  const vertices: Record<VertexId, VertexNode> = {};
  for (const v of g.vertices.values()) {
    vertices[v.id] = {
      id: v.id,
      position: v.position,
      hexIds: v.hexIds,
      settlementId: null,
      roadIds: Array.from(g.vertexEdges.get(v.id) ?? []),
    };
  }

  const edges: Record<EdgeId, EdgeNode> = {};
  for (const e of g.edges.values()) {
    edges[e.id] = {
      id: e.id,
      vertexAId: e.vertexAId,
      vertexBId: e.vertexBId,
      hexIds: e.hexIds,
      roadId: null,
    };
  }

  return {
    hexes,
    vertices,
    edges,
    settlements: {},
    roads: {},
    metadata: {
      id: options.id ?? `board-${Date.now()}`,
      version: 1,
      lastUpdated: Date.now(),
      generator: options.generator ?? 'custom',
    },
  };
}

/**
 * Standard 19-hex Catan board (radius 2) with shuffled terrain/tokens.
 * The desert is always the center hex.
 */
export function generateStandardBoard(hexSize: number = 50): Board {
  const layouts: HexLayout[] = assignStandardHexes(2).map((h) => ({
    coord: h.coord,
    terrain: h.terrain,
    rollNumber: h.rollNumber,
  }));
  return generateBoard(layouts, { generator: 'standard', hexSize });
}

/**
 * Small non-standard (L-shaped, 5-hex) layout used as the custom-map fixture
 * in the rebuild plan.
 */
export function generateCustomBoard(hexSize: number = 50): Board {
  const layouts: HexLayout[] = [
    { coord: { q: 0, r: 0, s: 0 }, terrain: 'Wood', rollNumber: 4 },
    { coord: { q: 1, r: 0, s: -1 }, terrain: 'Brick', rollNumber: 5 },
    { coord: { q: 0, r: 1, s: -1 }, terrain: 'Sheep', rollNumber: 6 },
    { coord: { q: 1, r: 1, s: -2 }, terrain: 'Wheat', rollNumber: 8 },
    { coord: { q: 2, r: 0, s: -2 }, terrain: 'Ore', rollNumber: 9 },
  ];
  return generateBoard(layouts, { generator: 'custom-l5', hexSize });
}
