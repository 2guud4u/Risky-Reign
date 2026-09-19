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
  PortType,
  VertexId,
  VertexNode,
} from '../types/Board';
import { BOARD_RADIUS, GAME_HEX_SIZE } from '../Constant';
import { CubeCoord } from '../types/Coordinates';
import { HexLayout } from '../types/BoardGenerator';
import { hexId as toHexId } from './coordinates';
import { assignStandardHexes } from './hex';
import { computeAdjacency } from './adjacency';

export { HexLayout };

/** Fisher-Yates shuffle (in place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/**
 * Assign trade ports (harbors) to boundary vertices (1-hex vertices).
 * There are 9 docks (classic Catan): 5 special (2:1, one per resource) and
 * 4 generic (3:1). Each dock is a stretch of coastline: it spans 1-2
 * consecutive boundary vertices, so a settlement on any vertex of the
 * stretch can use the dock. The layout is fully random: the resource
 * assignment, the dock order, the dock widths, and the start position are
 * all shuffled. A few coast vertices stay port-free.
 */
function assignPorts(vertices: Record<string, VertexNode>): void {
  const boundary = Object.values(vertices)
    .filter((v) => v.hexIds.length === 1)
    .sort((a, b) => Math.atan2(a.position.y, a.position.x) - Math.atan2(b.position.y, b.position.x));
  const n = boundary.length;
  if (n === 0) return;
  // 9 docks (classic Catan): 5 special (2:1, one per resource) + 4 generic
  // (3:1).
  const special: PortType[] = shuffle(['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore']);
  const docks: PortType[] = [...special];
  for (let i = 0; i < 4; i++) docks.push('generic');
  const count = Math.min(docks.length, n);
  // Widths: every dock spans one vertex; then hand out extra slots (max +1
  // per dock) so some docks expand to 2 vertices, leaving ~2 coast vertices
  // free. A dock never spans more than 2 vertices (classic Catan: a harbor
  // is bordered by 1-2 coastal intersections).
  const widths: number[] = [];
  for (let i = 0; i < count; i++) widths.push(1);
  const extra = Math.max(0, n - count - Math.min(2, n - count));
  for (let i = 0; i < extra; i++) {
    const candidates = widths.map((w, idx) => (w < 2 ? idx : -1)).filter((idx) => idx >= 0);
    if (candidates.length === 0) break;
    widths[candidates[Math.floor(Math.random() * candidates.length)]]++;
  }
  // Place the docks in a random order, starting at a random coast vertex.
  const order = shuffle(Array.from({ length: count }, (_, i) => i));
  let cursor = Math.floor(Math.random() * n);
  for (const di of order) {
    for (let w = 0; w < widths[di]; w++) {
      boundary[cursor % n].port = docks[di];
      cursor++;
    }
  }
}

export function generateBoard(
  layouts: HexLayout[],
  options: { id?: string; generator?: string; hexSize?: number } = {}
): Board {
  const hexSize = options.hexSize ?? GAME_HEX_SIZE;
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
      port: null,
    };
  }

  // Assign trade ports (harbors) to 10 boundary vertices:
  // 5 generic (3:1) + 5 special (2:1, one per resource).
  assignPorts(vertices);

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
    soldiers: {},
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
export function generateStandardBoard(hexSize: number = GAME_HEX_SIZE): Board {
  const layouts: HexLayout[] = assignStandardHexes(BOARD_RADIUS).map((h) => ({
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
