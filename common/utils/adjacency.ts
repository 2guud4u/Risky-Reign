// Pure adjacency computation for board graph
// Works with any hex layout, not just standard board

import { VertexNode } from '../types/Board'
import { HexNode } from '../types/Hex'
import { CubeCoord } from '../types/Coordinates'
import { calcEuclideanDistance } from './data'

export interface AdjacencyGraph {
  vertices: Map<string, Set<string>>
  edges: Map<string, [string, string]>
  vertexEdges: Map<string, Set<string>>
}

export interface VertexInfo {
  id: string
  coord: { x: number; y: number }
  hexes: CubeCoord[]
  corner: number
}

/**
 * Pure function to compute adjacency from hex layout
 * No assumptions about board shape or size
 */
export function computeAdjacency(
  hexes: HexNode[]
): AdjacencyGraph {
  const vertices = new Map<string, Set<string>>()
  const edges = new Map<string, [string, string]>()
  const vertexEdges = new Map<string, Set<string>>()
  
  // Map from vertex position to vertex info
  const vertexMap = new Map<string, VertexInfo>()
  
  // First pass: collect all vertices with their hex associations
  hexes.forEach(hex => {
    const { q, r, s } = hex.coord
    
    // Get 6 corners of hex
    for (let corner = 0; corner < 6; corner++) {
      // Calculate vertex position
      const vertexPos = getHexCornerPosition(q, r, s, corner)
      const key = `${vertexPos.x},${vertexPos.y}`
      
      if (!vertexMap.has(key)) {
        vertexMap.set(key, {
          id: `v_${q}_${r}_${s}_${corner}`,
          coord: vertexPos,
          hexes: [{ q, r, s }],
          corner
        })
      } else {
        // Vertex shared by multiple hexes
        const existing = vertexMap.get(key)!
        existing.hexes.push({ q, r, s })
      }
    }
  })
  
  // Second pass: build adjacency from shared vertices
  const vertexList = Array.from(vertexMap.values())
  
  vertexList.forEach(vertex => {
    vertices.set(vertex.id, new Set<string>())
    vertexEdges.set(vertex.id, new Set<string>())
  })
  
  // Find edges by checking neighboring vertices
  for (let i = 0; i < vertexList.length; i++) {
    for (let j = i + 1; j < vertexList.length; j++) {
      const v1 = vertexList[i]
      const v2 = vertexList[j]
      
      // Check if vertices share a hex edge
      if (areVerticesAdjacent(v1, v2, hexes)) {
        const edgeId = `e_${v1.id}_${v2.id}`
        
        // Store edge
        edges.set(edgeId, [v1.id, v2.id])
        
        // Update vertex adjacency
        vertices.get(v1.id)!.add(v2.id)
        vertices.get(v2.id)!.add(v1.id)
        
        // Update vertex-edge mapping
        vertexEdges.get(v1.id)!.add(edgeId)
        vertexEdges.get(v2.id)!.add(edgeId)
      }
    }
  }
  
  return { vertices, edges, vertexEdges }
}

/**
 * Check if two vertices are adjacent (share an edge)
 */
function areVerticesAdjacent(
  v1: VertexInfo,
  v2: VertexInfo,
  hexes: HexNode[]
): boolean {
  // Vertices are adjacent if they belong to the same hex
  // and are consecutive corners
  const sharedHexes = v1.hexes.filter(h1 => 
    v2.hexes.some(h2 => h1.q === h2.q && h1.r === h2.r && h1.s === h2.s)
  )
  
  if (sharedHexes.length === 0) return false
  
  // Check if corners are consecutive (difference of 1 mod 6)
  const cornerDiff = Math.abs(v1.corner - v2.corner)
  return cornerDiff === 1 || cornerDiff === 5
}

/**
 * Calculate hex corner position
 */
function getHexCornerPosition(
  q: number,
  r: number,
  s: number,
  corner: number,
  size: number = 50
): { x: number; y: number } {
  // Cube to pixel conversion
  const x = size * Math.sqrt(3) * (q + r / 2)
  const y = size * 1.5 * r
  
  // Corner offset
  const angle = Math.PI / 3 * corner
  const cornerX = size * Math.cos(angle)
  const cornerY = size * Math.sin(angle)
  
  return {
    x: x + cornerX,
    y: y + cornerY
  }
}

/**
 * Legacy compatibility: convert adjacency to VertexNode format
 */
export function buildVerticesFromAdjacency(
  hexes: HexNode[],
  adjacency: AdjacencyGraph
): VertexNode[] {
  const vertices: VertexNode[] = []
  const vertexMap = new Map<string, { x: number; y: number }>()
  
  // Build vertex positions
  hexes.forEach(hex => {
    const { q, r, s } = hex.coord
    for (let corner = 0; corner < 6; corner++) {
      const pos = getHexCornerPosition(q, r, s, corner)
      const id = `v_${q}_${r}_${s}_${corner}`
      vertexMap.set(id, pos)
    }
  })
  
  // Create VertexNodes
  for (const [id, neighbors] of adjacency.vertices) {
    const pos = vertexMap.get(id)
    if (!pos) continue
    
    vertices.push({
      id,
      coord: pos,
      vertices: neighbors,
      settlement: null,
      soldiers: [],
      roads: new Set()
    })
  }
  
  return vertices
}

/**
 * Test adjacency with irregular layouts
 */
export function testIrregularLayout(): AdjacencyGraph {
  // L-shaped 5 hex layout
  const hexes: HexNode[] = [
    { id: 'h1', coord: { q: 0, r: 0, s: 0 }, vertices: new Set(), terrain: 'Wood', robber: false, rollNumber: 4 },
    { id: 'h2', coord: { q: 1, r: 0, s: -1 }, vertices: new Set(), terrain: 'Brick', robber: false, rollNumber: 5 },
    { id: 'h3', coord: { q: 0, r: 1, s: -1 }, vertices: new Set(), terrain: 'Sheep', robber: false, rollNumber: 6 },
    { id: 'h4', coord: { q: 1, r: 1, s: -2 }, vertices: new Set(), terrain: 'Wheat', robber: false, rollNumber: 8 },
    { id: 'h5', coord: { q: 2, r: 0, s: -2 }, vertices: new Set(), terrain: 'Ore', robber: false, rollNumber: 9 },
  ]
  
  const adjacency = computeAdjacency(hexes)
  
  // Should work without assuming standard board
  return adjacency
}
