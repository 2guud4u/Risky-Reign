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

/**
 * Assign trade ports (harbors) to boundary vertices (1-hex vertices):
 * 5 generic (3:1) + 5 special (2:1, one per resource), interleaved and
 * spread evenly around the board by sorting boundary vertices by angle
 * from center and stepping through them at `count / total`.
 */
function assignPorts(vertices: Record<string, VertexNode>): void {
  const boundary = Object.values(vertices)
    .filter((v) => v.hexIds.length === 1)
    .sort((a, b) => Math.atan2(a.position.y, a.position.x) - Math.atan2(b.position.y, b.position.x));
  // One special port per resource, each followed by a generic port.
  const special: PortType[] = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'];
  const ports: PortType[] = [];
  for (const res of special) ports.push(res, 'generic');
  // Evenly space `ports.length` markers across the boundary ring.
  const step = boundary.length / ports.length;
  for (let i = 0; i < ports.length; i++) {
    const v = boundary[Math.floor(i * step)];
    if (v) v.port = ports[i];
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
