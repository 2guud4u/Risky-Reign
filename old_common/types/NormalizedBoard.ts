// Normalized board state for immutable updates
// Single source of truth, no duplication

export type VertexId = string
export type EdgeId = string
export type SettlementId = string
export type RoadId = string
export type HexId = string

export interface NormalizedBoard {
  // Core data - records for O(1) lookups
  vertices: Record<VertexId, BoardVertex>
  edges: Record<EdgeId, BoardEdge>
  settlements: Record<SettlementId, Settlement>
  roads: Record<RoadId, Road>
  hexes: Record<HexId, Hex>
  
  // Metadata
  metadata: {
    id: string
    version: number
    lastUpdated: number
    generator: string
  }
}

export interface BoardVertex {
  id: VertexId
  position: { x: number; y: number }
  settlementId: SettlementId | null
  soldierIds: string[]
  roadIds: EdgeId[]
  // Adjacency computed on demand
}

export interface BoardEdge {
  id: EdgeId
  vertexA: VertexId
  vertexB: VertexId
  roadId: RoadId | null
  position: { x1: number; y1: number; x2: number; y2: number }
}

export interface Settlement {
  id: SettlementId
  vertexId: VertexId
  playerId: string
  level: 'settlement' | 'city'
  builtAt: number
}

export interface Road {
  id: RoadId
  edgeId: EdgeId
  playerId: string
  builtAt: number
}

export interface Hex {
  id: HexId
  coord: { q: number; r: number; s: number }
  position: { x: number; y: number }
  terrain: string
  rollNumber: number | null
  resource: string
  vertexIds: VertexId[]
  edgeIds: EdgeId[]
}

// Immutable update helpers using Immer pattern

export function updateBoardState(
  state: NormalizedBoard,
  updates: Partial<NormalizedBoard>
): NormalizedBoard {
  return {
    ...state,
    ...updates,
    metadata: {
      ...state.metadata,
      version: state.metadata.version + 1,
      lastUpdated: Date.now()
    }
  }
}

export function addSettlement(
  state: NormalizedBoard,
  settlement: Settlement,
  vertexId: VertexId
): NormalizedBoard {
  return updateBoardState(state, {
    settlements: {
      ...state.settlements,
      [settlement.id]: settlement
    },
    vertices: {
      ...state.vertices,
      [vertexId]: {
        ...state.vertices[vertexId],
        settlementId: settlement.id
      }
    }
  })
}

export function addRoad(
  state: NormalizedBoard,
  road: Road,
  edgeId: EdgeId
): NormalizedBoard {
  return updateBoardState(state, {
    roads: {
      ...state.roads,
      [road.id]: road
    },
    edges: {
      ...state.edges,
      [edgeId]: {
        ...state.edges[edgeId],
        roadId: road.id
      }
    }
  })
}

// Selectors for derived data
export function getVertexNeighbors(
  state: NormalizedBoard,
  vertexId: VertexId
): VertexId[] {
  const vertex = state.vertices[vertexId]
  if (!vertex) return []
  
  // Find edges connected to vertex
  const edgeIds = Object.values(state.edges)
    .filter(e => e.vertexA === vertexId || e.vertexB === vertexId)
    .map(e => e.id)
  
  // Find neighboring vertices
  const neighbors = new Set<VertexId>()
  edgeIds.forEach(edgeId => {
    const edge = state.edges[edgeId]
    if (edge.vertexA === vertexId) {
      neighbors.add(edge.vertexB)
    } else {
      neighbors.add(edge.vertexA)
    }
  })
  
  return Array.from(neighbors)
}

export function getEdgeVertices(
  state: NormalizedBoard,
  edgeId: EdgeId
): [VertexId, VertexId] | null {
  const edge = state.edges[edgeId]
  return edge ? [edge.vertexA, edge.vertexB] : null
}

export function getValidSettlementPlacements(
  state: NormalizedBoard,
  playerId: string
): VertexId[] {
  return Object.values(state.vertices)
    .filter(v => 
      v.settlementId === null &&
      // Check if adjacent to player's existing settlements/roads
      hasAdjacentToPlayer(state, v.id, playerId)
    )
    .map(v => v.id)
}

export function hasAdjacentToPlayer(
  state: NormalizedBoard,
  vertexId: VertexId,
  playerId: string
): boolean {
  const neighbors = getVertexNeighbors(state, vertexId)
  
  // Check if any neighbor has player's settlement
  return neighbors.some(nId => {
    const neighbor = state.vertices[nId]
    if (!neighbor || !neighbor.settlementId) return false
    const settlement = state.settlements[neighbor.settlementId]
    return settlement?.playerId === playerId
  }) || 
  // Check if any connected edge has player's road
  Object.values(state.edges)
    .filter(e => e.vertexA === vertexId || e.vertexB === vertexId)
    .some(e => {
      if (!e.roadId) return false
      const road = state.roads[e.roadId]
      return road?.playerId === playerId
    })
}
