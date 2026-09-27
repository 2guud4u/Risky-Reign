import {
  AGGREGATE_MAX_VISIBLE,
  CLUSTER_MAX_RADIUS,
  GARRISON_REGION_ORDER,
  MINI_LABEL_DIST,
  MINI_LABEL_HALF_H,
  MINI_LABEL_HALF_W,
  RANK_SPACING,
  REGION_SPACING,
  SEPARATION_FACTOR,
  SEPARATION_ITERATIONS,
  SOLDIER_ART_HEIGHT,
  SOLDIER_SPACING,
} from '../constants';
import { Board, EdgeNode, GAME_HEX_SIZE, HexNode, PixelCoord, VertexNode, cubeToPixel } from 'common';
import { neighborNicknames } from './neighborLabels';
import { groupSoldiersByOwner, ownerAngle } from './soldierPlacement';
import {
  EdgeMiniLayout,
  GarrisonCluster,
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

/**
 * Compute each garrison cluster's anchor (world coords) and radius. A lone
 * group is centered on the vertex; otherwise each owner takes a region (≤9)
 * or an evenly-spaced angle (>9), at REGION_SPACING from the vertex, and
 * overlapping clusters are pushed apart by a deterministic separation pass.
 */
export function layoutGarrisonClusters(
  board: Board,
  vertex: VertexNode
): GarrisonCluster[] {
  const soldiersAt = Object.values(board.soldiers ?? {}).filter((s) => s.vertexId === vertex.id);
  const byOwner = groupSoldiersByOwner(soldiersAt);
  const owners = Array.from(byOwner.keys());
  const entries = Array.from(byOwner.entries());

  const clusters: GarrisonCluster[] = entries.map(([ownerName, group], idx) => {
    let anchor: PixelCoord;
    if (owners.length === 1) {
      anchor = { x: vertex.position.x, y: vertex.position.y };
    } else if (owners.length <= GARRISON_REGION_ORDER.length) {
      const region = GARRISON_REGION_ORDER[idx];
      anchor = {
        x: vertex.position.x + region.dx * REGION_SPACING,
        y: vertex.position.y + region.dy * REGION_SPACING,
      };
    } else {
      const angle = ownerAngle(idx, byOwner.size);
      anchor = {
        x: vertex.position.x + Math.cos(angle) * REGION_SPACING,
        y: vertex.position.y + Math.sin(angle) * REGION_SPACING,
      };
    }
    // Radius from the visible count (aggregate caps the visible soldiers).
    const visibleCount = Math.min(group.length, AGGREGATE_MAX_VISIBLE);
    const cols = Math.max(1, Math.ceil(Math.sqrt(visibleCount)));
    const rows = Math.max(1, Math.ceil(visibleCount / cols));
    const extent = Math.max((rows - 1) * RANK_SPACING, (cols - 1) * SOLDIER_SPACING);
    const radius = Math.min(extent / 2, CLUSTER_MAX_RADIUS);
    return { ownerName, group, anchor, radius };
  });

  // Collision separation: push overlapping clusters apart (deterministic).
  for (let iter = 0; iter < SEPARATION_ITERATIONS; iter++) {
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dx = clusters[j].anchor.x - clusters[i].anchor.x;
        const dy = clusters[j].anchor.y - clusters[i].anchor.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = (clusters[i].radius + clusters[j].radius) * SEPARATION_FACTOR;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          clusters[i].anchor.x -= ux * push;
          clusters[i].anchor.y -= uy * push;
          clusters[j].anchor.x += ux * push;
          clusters[j].anchor.y += uy * push;
        }
      }
    }
  }
  return clusters;
}

/** Hexes adjacent to the selected object (the neighborhood terrain backdrop). */
const selectionHexes = (board: Board, type: 'vertex' | 'edge', id: string): HexNode[] =>
  type === 'vertex'
    ? (board.vertices[id]?.hexIds ?? []).map((hid) => board.hexes[hid]).filter(Boolean)
    : (board.edges[id]?.hexIds ?? []).map((hid) => board.hexes[hid]).filter(Boolean);

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

  // Nicknames for the neighbor circles (a, b, c, …) — the same mapping the
  // sidebar's "Move to b" buttons use, so the map and buttons agree.
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
  // each owner's troops form a cluster; registering each cluster's bounding
  // corners sizes the viewBox to fit them (SoldierGroup positions can't
  // influence the viewBox — render runs after the size is computed).
  const clusters = showGarrisonedSoldiers ? layoutGarrisonClusters(board, vertex) : [];
  for (const c of clusters) {
    points.push(
      { x: c.anchor.x - c.radius, y: c.anchor.y - c.radius },
      { x: c.anchor.x + c.radius, y: c.anchor.y - c.radius },
      { x: c.anchor.x - c.radius, y: c.anchor.y + c.radius },
      { x: c.anchor.x + c.radius, y: c.anchor.y + c.radius }
    );
  }

  const hexes = selectionHexes(board, 'vertex', vertexId);
  hexes.forEach((h) => points.push(cubeToPixel(h.coord, GAME_HEX_SIZE)));

  return {
    vertex,
    neighbors,
    clusters,
    hasSettlement: vertex.settlementId !== null,
    hexes,
    points,
    focus: vertex.position,
  };
}

/**
 * Layout for a selected edge: its two endpoint vertices. Returns null when the
 * edge id or either endpoint is stale.
 */
export function edgeMiniLayout(board: Board, edgeId: string): EdgeMiniLayout | null {
  const edge = board.edges[edgeId];
  if (!edge) return null;
  const a = board.vertices[edge.vertexAId];
  const b = board.vertices[edge.vertexBId];
  if (!a || !b) return null;

  const road = edge.roadId ? board.roads[edge.roadId] : null;
  const hexes = selectionHexes(board, 'edge', edgeId);
  const points: PixelCoord[] = [a.position, b.position];
  hexes.forEach((h) => points.push(cubeToPixel(h.coord, GAME_HEX_SIZE)));

  return {
    edge,
    endpoints: [a, b],
    roadOwnerId: road?.ownerId ?? null,
    hexes,
    points,
    // Center the view on the edge midpoint.
    focus: { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 },
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
