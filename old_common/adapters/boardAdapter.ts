import { Board } from '../types/Board';
import { BoardUIState, BoardVertex, BoardEdge, BoardHex } from '../types/BoardUI';
import { CubeCoord, PixelCoord } from '../types/Coordinates';

/**
 * Adapter Layer: Convert domain Board to presentation BoardUIState
 * Single conversion point - no domain types leak to UI
 */

export function domainToPresentation(board: Board): BoardUIState {
  // Compute adjacency maps for quick lookups
  const vertexMap = new Map<string, BoardVertex>();
  const edgeMap = new Map<string, BoardEdge>();
  const hexMap = new Map<string, BoardHex>();
  
  // Convert hexes
  Object.entries(board.hexes).forEach(([id, hex]) => {
    const position = cubeToPixel(hex.coord.q, hex.coord.r, hex.coord.s, 50);
    hexMap.set(id, {
      id,
      position,
      terrain: hex.terrain,
      rollNumber: hex.rollNumber,
      hasRobber: hex.robber,
      vertexIds: [], // Would compute from adjacency
      edgeIds: [],
    });
  });
  
  // Convert vertices
  Object.entries(board.vertices).forEach(([id, vertex]) => {
    vertexMap.set(id, {
      id,
      position: vertex.position,
      isSelectable: true, // Computed based on build rules
      hasSettlement: vertex.settlementId !== null,
      settlementLevel: vertex.settlementId ? 
        board.settlements[vertex.settlementId]?.level || 'settlement' : 'none',
      settlementOwnerId: vertex.settlementId ? 
        board.settlements[vertex.settlementId]?.ownerId || null : null,
      adjacentEdgeIds: vertex.roadIds,
      adjacentVertexIds: [], // Would compute from adjacency
      isHovered: false,
      isSelected: false,
    });
  });
  
  // Convert edges
  Object.entries(board.edges).forEach(([id, edge]) => {
    const startVertex = board.vertices[edge.vertexAId];
    const endVertex = board.vertices[edge.vertexBId];
    
    edgeMap.set(id, {
      id,
      start: startVertex?.position || { x: 0, y: 0 },
      end: endVertex?.position || { x: 0, y: 0 },
      hasRoad: edge.roadId !== null,
      roadOwnerId: edge.roadId ? 
        board.roads[edge.roadId]?.ownerId || null : null,
      isSelectable: true,
      isHovered: false,
      isSelected: false,
    });
  });
  
  return {
    vertices: Object.fromEntries(vertexMap),
    edges: Object.fromEntries(edgeMap),
    hexes: Object.fromEntries(hexMap),
    selectedVertexId: null,
    selectedEdgeId: null,
    hoveredVertexId: null,
    hoveredEdgeId: null,
    buildMode: 'none',
    canBuildSettlement: false,
    canBuildRoad: false,
  };
}

/**
 * Update presentation state with interaction changes
 */
export function updatePresentationState(
  state: BoardUIState,
  updates: Partial<BoardUIState>
): BoardUIState {
  return {
    ...state,
    ...updates,
    vertices: {
      ...state.vertices,
      ...Object.fromEntries(
        Object.entries(updates.vertices || {}).map(([id, v]) => [id, { ...state.vertices[id], ...v }])
      )
    },
    edges: {
      ...state.edges,
      ...Object.fromEntries(
        Object.entries(updates.edges || {}).map(([id, e]) => [id, { ...state.edges[id], ...e }])
      )
    }
  };
}

function cubeToPixel(q: number, r: number, s: number, size: number): PixelCoord {
  const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = size * (3 / 2 * r);
  return { x, y };
}

/**
 * Presentation to domain: Extract build actions
 */
export function extractBuildActions(state: BoardUIState) {
  return {
    settlementVertexId: state.selectedVertexId,
    roadEdgeId: state.selectedEdgeId,
    buildMode: state.buildMode,
  };
}
