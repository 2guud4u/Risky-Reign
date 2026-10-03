import {
  MINI_LABEL_DIST,
  MINI_LABEL_HALF_H,
  MINI_LABEL_HALF_W,
  SOLDIER_ART_HEIGHT,
} from '../constants';
import { Board, EdgeNode, GAME_HEX_SIZE, HexNode, PixelCoord, cubeToPixel } from 'common';
import { neighborNicknames } from './neighborLabels';
import { layoutGarrisonArmies } from './garrisonFormation';
import {
  MiniViewBox,
  RoadStroke,
  VertexMiniLayout,
  VertexNeighbor,
} from '../types/miniMap';

/**
 * Pure layout/geometry for the mini-map (MiniView): which objects surround the
 * selection, where their labels and soldier clusters sit, and the viewBox that
 * frames it all. No JSX and no React state — the components only render what
 * these functions compute.
 */

/** Stroke color/width for an edge line: owned roads are tinted in the road
 *  owner's color and drawn thicker, mirroring the main board. */
export const roadStroke = (
  board: Board,
  edge: EdgeNode,
  playerColors?: Record<string, string>
): RoadStroke => {
  const road = edge.roadId ? board.roads[edge.roadId] : null;
  return {
    color: road ? (playerColors?.[road.ownerId] ?? '#8B4513') : '#9ca3af',
    width: road ? 6 : 4,
  };
};

/**
 * Label placement for a neighbor circle: the anchor sits just outside the
 * circle on the far side from the selected vertex, so it doesn't sit on the
 * road line. The returned bounds are the glyph's full extent (not just its
 * anchor) so edge letters aren't clipped by the viewBox.
 */
const neighborLabel = (
  selectedPos: PixelCoord,
  neighborPos: PixelCoord
): { pos: PixelCoord; bounds: PixelCoord[] } => {
  const dx = neighborPos.x - selectedPos.x;
  const dy = neighborPos.y - selectedPos.y;
  const len = Math.hypot(dx, dy) || 1;
  const pos = {
    x: neighborPos.x + (dx / len) * MINI_LABEL_DIST,
    y: neighborPos.y + (dy / len) * MINI_LABEL_DIST,
  };
  return {
    pos,
    bounds: [
      { x: pos.x - MINI_LABEL_HALF_W, y: pos.y - MINI_LABEL_HALF_H },
      { x: pos.x + MINI_LABEL_HALF_W, y: pos.y - MINI_LABEL_HALF_H },
      { x: pos.x - MINI_LABEL_HALF_W, y: pos.y + MINI_LABEL_HALF_H },
      { x: pos.x + MINI_LABEL_HALF_W, y: pos.y + MINI_LABEL_HALF_H },
    ],
  };
};

/** Hexes adjacent to the vertex (the neighborhood terrain backdrop). */
const vertexHexes = (board: Board, vertexId: string): HexNode[] =>
  (board.vertices[vertexId]?.hexIds ?? []).map((hid) => board.hexes[hid]).filter(Boolean);

/**
 * Layout for a selected vertex: its neighbors (edges, circles, letter labels)
 * and garrisoned-soldier clusters, plus every point the viewBox must cover.
 * Returns null when the vertex id is stale.
 */
export function vertexMiniLayout(
  board: Board,
  vertexId: string,
  showGarrisonedSoldiers: boolean
): VertexMiniLayout | null {
  const vertex = board.vertices[vertexId];
  if (!vertex) return null;

  const points: PixelCoord[] = [vertex.position];

  // Nicknames for the neighbor circles (a, b, c, …), stable per neighbor.
  const nicknames = neighborNicknames(board, vertexId);

  const neighbors: VertexNeighbor[] = [];
  for (const edgeId of vertex.roadIds) {
    const edge = board.edges[edgeId];
    if (!edge) continue;
    const otherId = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
    const other = board.vertices[otherId];
    if (!other) continue;
    points.push(other.position);
    const entry: VertexNeighbor = { edge, vertex: other };
    const label = nicknames[other.id];
    if (label) {
      const { pos, bounds } = neighborLabel(vertex.position, other.position);
      entry.label = label;
      entry.labelPos = pos;
      entry.labelBounds = bounds;
      points.push(...bounds);
    }
    neighbors.push(entry);
  }

  // Garrisoned soldiers (including injured, so they can be selected to heal):
  // each owner's troops form an army; registering each army's bounding box
  // corners sizes the viewBox to fit them (SoldierGroup positions can't
  // influence the viewBox — render runs after the size is computed).
  const armies = showGarrisonedSoldiers ? layoutGarrisonArmies(board, vertex) : [];
  for (const a of armies) {
    const { minX, maxX, minY, maxY } = a.bounds;
    points.push(
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: minX, y: maxY },
      { x: maxX, y: maxY }
    );
  }

  const hexes = vertexHexes(board, vertexId);
  hexes.forEach((h) => points.push(cubeToPixel(h.coord, GAME_HEX_SIZE)));

  return {
    vertex,
    neighbors,
    armies,
    hasSettlement: vertex.settlementId !== null,
    hexes,
    points,
    focus: vertex.position,
  };
}

/**
 * Centered square viewBox: fits every layout point while keeping the focus
 * point centered, padded by half a soldier sprite so sprite edges aren't
 * clipped, and never smaller than `minViewSize`.
 */
export function miniMapViewBox(
  points: PixelCoord[],
  focus: PixelCoord,
  minViewSize?: number
): MiniViewBox | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = SOLDIER_ART_HEIGHT / 2;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const bboxSize = Math.max(maxX - minX, maxY - minY);
  const maxDistFromFocus = Math.max(
    ...points.map((p) => Math.hypot(p.x - focus.x, p.y - focus.y))
  );
  const size = Math.max(bboxSize, maxDistFromFocus * 2 + pad * 2, minViewSize ?? 0);
  return { x: focus.x - size / 2, y: focus.y - size / 2, size };
}
