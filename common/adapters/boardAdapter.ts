/**
 * Adapter layer: the single conversion point between the domain Board and the
 * presentation BoardUIState. No domain types leak into UI components beyond
 * the BoardUI* shapes.
 */

import { Board, EdgeId, HexId, VertexId } from '../types/Board';
import {
  BoardEdge,
  BoardHex,
  BoardUIState,
  BoardVertex,
} from '../types/BoardUI';
import { cubeToPixel } from '../types/Coordinates';

/**
 * Convert a domain Board into a fresh (non-interacted) presentation state.
 * @param board   - domain board
 * @param hexSize - pixel size used to project hex centers (vertex/edge
 *                  positions come pre-projected from the domain board)
 */
export function domainToPresentation(board: Board, hexSize: number = 50): BoardUIState {
  const vertices: Record<VertexId, BoardVertex> = {};
  const edges: Record<EdgeId, BoardEdge> = {};
  const hexes: Record<HexId, BoardHex> = {};

  // Hexes
  for (const hex of Object.values(board.hexes)) {
    hexes[hex.id] = {
      id: hex.id,
      position: cubeToPixel(hex.coord, hexSize),
      terrain: hex.terrain,
      rollNumber: hex.rollNumber,
      hasRobber: hex.robber,
      vertexIds: [],
      edgeIds: [],
    };
  }

  // Vertices
  for (const v of Object.values(board.vertices)) {
    const settlement = v.settlementId ? board.settlements[v.settlementId] : null;
    const adjacentVertexIds: VertexId[] = [];
    const adjacentEdgeIds: EdgeId[] = [];
    for (const edgeId of v.roadIds) {
      const edge = board.edges[edgeId];
      if (!edge) continue;
      adjacentEdgeIds.push(edge.id);
      const other = edge.vertexAId === v.id ? edge.vertexBId : edge.vertexAId;
      if (other !== v.id) adjacentVertexIds.push(other);
    }
    vertices[v.id] = {
      id: v.id,
      position: v.position,
      isSelectable: true,
      hasSettlement: settlement !== null,
      settlementLevel: settlement ? settlement.level : 'none',
      settlementOwnerId: settlement ? settlement.ownerId : null,
      adjacentEdgeIds,
      adjacentVertexIds: Array.from(new Set(adjacentVertexIds)),
      isHovered: false,
      isSelected: false,
    };
  }

  // Edges
  for (const e of Object.values(board.edges)) {
    const a = board.vertices[e.vertexAId];
    const b = board.vertices[e.vertexBId];
    const road = e.roadId ? board.roads[e.roadId] : null;
    edges[e.id] = {
      id: e.id,
      start: a ? a.position : { x: 0, y: 0 },
      end: b ? b.position : { x: 0, y: 0 },
      hasRoad: road !== null,
      roadOwnerId: road ? road.ownerId : null,
      isSelectable: true,
      isHovered: false,
      isSelected: false,
    };
  }

  // Back-fill hex vertex/edge ids
  for (const v of Object.values(board.vertices)) {
    for (const hid of v.hexIds) {
      const h = hexes[hid];
      if (h && !h.vertexIds.includes(v.id)) h.vertexIds.push(v.id);
    }
  }
  for (const e of Object.values(board.edges)) {
    for (const hid of e.hexIds) {
      const h = hexes[hid];
      if (h && !h.edgeIds.includes(e.id)) h.edgeIds.push(e.id);
    }
  }

  return {
    vertices,
    edges,
    hexes,
    selectedVertexId: null,
    selectedEdgeId: null,
    hoveredVertexId: null,
    hoveredEdgeId: null,
    buildMode: 'none',
    roadStartVertexId: null,
    validVertexIds: [],
    validEdgeIds: [],
    canBuildSettlement: false,
    canBuildRoad: false,
  };
}

/**
 * Merge partial interaction updates into a presentation state immutably.
 */
export function updatePresentationState(
  state: BoardUIState,
  updates: Partial<BoardUIState>
): BoardUIState {
  return {
    ...state,
    ...updates,
    vertices: { ...state.vertices, ...(updates.vertices ?? {}) },
    edges: { ...state.edges, ...(updates.edges ?? {}) },
    hexes: { ...state.hexes, ...(updates.hexes ?? {}) },
  };
}

/** Extract the build action implied by the current interaction state. */
export function extractBuildActions(state: BoardUIState): {
  settlementVertexId: VertexId | null;
  roadEdgeId: EdgeId | null;
  buildMode: BoardUIState['buildMode'];
} {
  return {
    settlementVertexId: state.buildMode === 'settlement' ? state.selectedVertexId : null,
    roadEdgeId: state.buildMode === 'road' ? state.selectedEdgeId : null,
    buildMode: state.buildMode,
  };
}
