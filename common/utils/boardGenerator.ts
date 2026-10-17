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
import { DockSpec, HexLayout } from '../types/BoardGenerator';
import { hexId as toHexId, getNeighbors } from './coordinates';
import { assignStandardHexes } from './hex';
import { computeAdjacency } from './adjacency';

/**
 * Wrap a land layout in one ring of Water hexes — every empty neighbor of
 * a land hex becomes water. Custom maps may stay ringless (coast = land +
 * empty is still legal); generated standard/expansion boards always ring.
 */
export function withWaterRing(layouts: HexLayout[]): HexLayout[] {
  const land = new Set(layouts.map((l) => `${l.coord.q},${l.coord.r},${l.coord.s}`));
  const water = new Map<string, CubeCoord>();
  for (const l of layouts) {
    for (const n of getNeighbors(l.coord)) {
      const key = `${n.q},${n.r},${n.s}`;
      if (!land.has(key) && !water.has(key)) water.set(key, n);
    }
  }
  return [...layouts, ...[...water.values()].map((coord) => ({ coord, terrain: 'Water' as const, rollNumber: null }))];
}

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
 * The coast ring: vertices touching exactly one non-water hex (land or
 * desert), sorted by angle around the board origin — the stable order the
 * editor's coast indices and saved dock specs both address.
 */
export function coastRing(
  vertices: { position: { x: number; y: number }; hexIds: string[] }[],
  isWater: (hexId: string) => boolean
): { position: { x: number; y: number }; hexIds: string[] }[] {
  return vertices
    .filter((v) => v.hexIds.filter((id) => !isWater(id)).length === 1)
    .sort((a, b) => Math.atan2(a.position.y, a.position.x) - Math.atan2(b.position.y, b.position.x));
}

/**
 * Roll a random dock layout for a coast ring of length n: 9 docks (5 special
 * 2:1 + 4 generic 3:1), shuffled order/types, spans of 1-2 vertices; a
 * shorter coast drops the extra docks.
 */
export function randomDocks(n: number): DockSpec[] {
  if (n === 0) return [];
  const special: PortType[] = shuffle(['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore']);
  const pool: PortType[] = [...special];
  for (let i = 0; i < 4; i++) pool.push('generic');
  const count = Math.min(pool.length, n);
  // Widths: every dock spans one vertex; then hand out extra slots (max +1
  // per dock) so some docks expand to 2, leaving ~2 coast vertices free.
  const widths: number[] = [];
  for (let i = 0; i < count; i++) widths.push(1);
  const extra = Math.max(0, n - count - Math.min(2, n - count));
  for (let i = 0; i < extra; i++) {
    const candidates = widths.map((w, idx) => (w < 2 ? idx : -1)).filter((idx) => idx >= 0);
    if (candidates.length === 0) break;
    widths[candidates[Math.floor(Math.random() * candidates.length)]]++;
  }
  const order = shuffle(Array.from({ length: count }, (_, i) => i));
  let cursor = Math.floor(Math.random() * n);
  const docks: DockSpec[] = [];
  for (const di of order) {
    const span: number[] = [];
    for (let w = 0; w < widths[di]; w++) {
      span.push(cursor % n);
      cursor++;
    }
    docks.push({ port: pool[di], coast: span });
  }
  return docks;
}

/**
 * Write dock assignments onto coast vertices. Explicit `docks` place the
 * exact spans the editor saved; absent = a fresh shuffled coast.
 */
function assignPorts(
  vertices: Record<string, VertexNode>,
  hexes: Record<HexId, HexNode>,
  docks?: DockSpec[]
): void {
  const ring = coastRing(Object.values(vertices), (id) => hexes[id]?.terrain === 'Water');
  const n = ring.length;
  if (n === 0) return;
  for (const d of docks ?? randomDocks(n)) {
    for (const i of d.coast.slice(0, 2)) {
      const v = ring[i % n];
      if (v) (v as VertexNode).port = d.port;
    }
  }
}

/**
 * Read a board's ports back out as dock specs: walk the coast ring and merge
 * consecutive vertices carrying the same port into one span (max 2 — the
 * merge closes across the ring seam only for a genuine wraparound dock).
 * Inverse of `assignPorts`' explicit-docks path; used to seed the board
 * editor and presets from a live board.
 */
export function extractDocks(board: Board): DockSpec[] {
  const ring = coastRing(
    Object.values(board.vertices),
    (id) => board.hexes[id]?.terrain === 'Water'
  ) as VertexNode[];
  const n = ring.length;
  if (n === 0) return [];
  const docks: DockSpec[] = [];
  let open: DockSpec | null = null;
  for (let i = 0; i < n; i++) {
    const port = ring[i].port;
    if (port && open && open.port === port && open.coast.length === 1) {
      open.coast.push(i);
    } else {
      if (open) docks.push(open);
      open = port ? { port, coast: [i] } : null;
    }
  }
  if (!open) return docks;
  const first = docks[0];
  if (first && first.coast.length === 1 && first.port === open.port) {
    // A len-2 dock wrapping the seam: first vertex is index 0, last is n-1.
    // Keep it one dock — [n-1, n] — so a round-trip re-applies it identically.
    first.coast = [n - 1, n];
    return docks;
  }
  docks.push(open);
  return docks;
}

export function generateBoard(
  layouts: HexLayout[],
  options: { id?: string; generator?: string; hexSize?: number; docks?: DockSpec[] } = {}
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
      robber: false,
    };
  }
  // The robber's home: the first Desert, or the first hex if there is none.
  // Exactly one hex is the robber's starting position.
  const homeLayout = layouts.find((l) => l.terrain === 'Desert') ?? layouts[0];
  if (homeLayout) {
    hexes[toHexId(homeLayout.coord)].robber = true;
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

  // Assign trade ports (harbors): explicit docks when the caller supplied
  // them (editor save), else a shuffled coast layout.
  assignPorts(vertices, hexes, options.docks);

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
 * Standard 19-hex Catan board (radius 2) with shuffled terrain/tokens,
 * ringed by water so every coast dock sits at a land–sea vertex.
 * The desert is always the center hex.
 */
export function generateStandardBoard(hexSize: number = GAME_HEX_SIZE): Board {
  const layouts: HexLayout[] = withWaterRing(
    assignStandardHexes(BOARD_RADIUS).map((h) => ({
      coord: h.coord,
      terrain: h.terrain,
      rollNumber: h.rollNumber,
    }))
  );
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
