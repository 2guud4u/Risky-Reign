import { Board, HexNode, VertexNode, EdgeNode, HexId, VertexId, EdgeId } from '../types/Board';
import { CubeCoord, canonicalVertexId, canonicalEdgeId, cubeToPixel } from '../types/Coordinates';

/**
 * Generate a standard Catan board with 19 hexes
 * Uses coordinate-derived IDs for vertices and edges
 */

export interface HexLayout {
  coord: CubeCoord;
  terrain: string;
  rollNumber: number | null;
}

export function generateStandardBoard(): Board {
  const hexLayouts: HexLayout[] = [
    { coord: { q: 0, r: -2, s: 2 }, terrain: 'forest', rollNumber: 9 },
    { coord: { q: 1, r: -2, s: 1 }, terrain: 'pasture', rollNumber: 4 },
    { coord: { q: 2, r: -2, s: 0 }, terrain: 'hills', rollNumber: 10 },
    { coord: { q: -1, r: -1, s: 2 }, terrain: 'mountains', rollNumber: 10 },
    { coord: { q: 0, r: -1, s: 1 }, terrain: 'fields', rollNumber: 11 },
    { coord: { q: 1, r: -1, s: 0 }, terrain: 'forest', rollNumber: 6 },
    { coord: { q: 2, r: -1, s: -1 }, terrain: 'pasture', rollNumber: 9 },
    { coord: { q: -2, r: 0, s: 2 }, terrain: 'hills', rollNumber: 9 },
    { coord: { q: -1, r: 0, s: 1 }, terrain: 'pasture', rollNumber: 3 },
    { coord: { q: 0, r: 0, s: 0 }, terrain: 'desert', rollNumber: null },
    { coord: { q: 1, r: 0, s: -1 }, terrain: 'mountains', rollNumber: 8 },
    { coord: { q: 2, r: 0, s: -2 }, terrain: 'hills', rollNumber: 8 },
    { coord: { q: -2, r: 1, s: 1 }, terrain: 'forest', rollNumber: 8 },
    { coord: { q: -1, r: 1, s: 0 }, terrain: 'pasture', rollNumber: 5 },
    { coord: { q: 0, r: 1, s: -1 }, terrain: 'fields', rollNumber: 6 },
    { coord: { q: 1, r: 1, s: -2 }, terrain: 'mountains', rollNumber: 4 },
    { coord: { q: -1, r: 2, s: -1 }, terrain: 'fields', rollNumber: 5 },
    { coord: { q: 0, r: 2, s: -2 }, terrain: 'forest', rollNumber: 11 },
    { coord: { q: 1, r: 2, s: -3 }, terrain: 'pasture', rollNumber: 12 },
  ];

  const hexes: Record<HexId, HexNode> = {};
  const hexCoords = hexLayouts.map(h => h.coord);
  
  // Create hexes
  hexLayouts.forEach((layout, idx) => {
    const id = `h_${layout.coord.q},${layout.coord.r},${layout.coord.s}`;
    hexes[id] = {
      id,
      coord: layout.coord,
      terrain: layout.terrain,
      rollNumber: layout.rollNumber,
      robber: false,
    };
  });

  // Generate vertices and edges
  const vertices = generateVertices(hexCoords);
  const edges = generateEdges(hexCoords, vertices);

  return {
    hexes,
    vertices,
    edges,
    settlements: {},
    roads: {},
    metadata: {
      id: 'board-' + Date.now(),
      version: 1,
      lastUpdated: Date.now(),
      generator: 'standard',
    }
  };
}

function generateVertices(hexCoords: CubeCoord[]): Record<VertexId, VertexNode> {
  const vertexMap = new Map<VertexId, { hexIds: string[], position: { x: number, y: number } }>();
  
  // For each hex, find its 6 vertices
  hexCoords.forEach(hex => {
    const hexId = `h_${hex.q},${hex.r},${hex.s}`;
    
    // Get neighboring hexes
    const neighbors = getNeighbors(hex).filter(n => 
      hexCoords.some(h => h.q === n.q && h.r === n.r && h.s === n.s)
    );
    
    // Create vertices for each edge between hex and neighbor
    neighbors.forEach((neighbor, idx) => {
      const neighborId = `h_${neighbor.q},${neighbor.r},${neighbor.s}`;
      
      // Find the vertex shared by these two hexes
      // For simplicity, we'll use the midpoint of the edge
      const vertexHexIds = [hex, neighbor];
      const vertexId = canonicalVertexId(vertexHexIds);
      
      if (!vertexMap.has(vertexId)) {
        // Compute position as average of hex centers
        const pos1 = cubeToPixel(hex.q, hex.r, hex.s, 50);
        const pos2 = cubeToPixel(neighbor.q, neighbor.r, neighbor.s, 50);
        const position = {
          x: (pos1.x + pos2.x) / 2,
          y: (pos1.y + pos2.y) / 2,
        };
        
        vertexMap.set(vertexId, {
          hexIds: [hexId, neighborId],
          position,
        });
      } else {
        // Add this hex to existing vertex
        const existing = vertexMap.get(vertexId)!;
        if (!existing.hexIds.includes(hexId)) {
          existing.hexIds.push(hexId);
        }
      }
    });
  });

  // Convert to VertexNode format
  const result: Record<VertexId, VertexNode> = {};
  vertexMap.forEach((data, id) => {
    result[id] = {
      id,
      position: { x: data.position.x, y: data.position.y },
      hexIds: data.hexIds,
      settlementId: null,
      roadIds: [],
    };
  });
  
  return result;
}

function generateEdges(
  hexCoords: CubeCoord[], 
  vertices: Record<VertexId, VertexNode>
): Record<EdgeId, EdgeNode> {
  const edgeMap = new Map<EdgeId, { vertexAId: VertexId, vertexBId: VertexId, hexIds: string[] }>();
  
  hexCoords.forEach(hex => {
    const hexId = `h_${hex.q},${hex.r},${hex.s}`;
    const neighbors = getNeighbors(hex).filter(n => 
      hexCoords.some(h => h.q === n.q && h.r === n.r && h.s === n.s)
    );
    
    neighbors.forEach(neighbor => {
      const neighborId = `h_${neighbor.q},${neighbor.r},${neighbor.s}`;
      
      // Find vertices for this edge
      const edgeHexIds = [hex, neighbor];
      const edgeId = canonicalEdgeId(edgeHexIds);
      
      if (!edgeMap.has(edgeId)) {
        // Find the two vertices that define this edge
        // This is simplified - actual implementation would need proper vertex finding
        const vertexId1 = `v_${hex.q},${hex.r},${hex.s}_${neighbor.q},${neighbor.r},${neighbor.s}`;
        const vertexId2 = `v_${hex.q},${hex.r},${hex.s}_${neighbor.q},${neighbor.r},${neighbor.s}`;
        
        edgeMap.set(edgeId, {
          vertexAId: vertexId1,
          vertexBId: vertexId2,
          hexIds: [hexId, neighborId],
        });
      }
    });
  });
  
  const result: Record<EdgeId, EdgeNode> = {};
  edgeMap.forEach((data, id) => {
    result[id] = {
      id,
      vertexAId: data.vertexAId,
      vertexBId: data.vertexBId,
      hexIds: data.hexIds,
      roadId: null,
    };
  });
  
  return result;
}

function getNeighbors(coord: CubeCoord): CubeCoord[] {
  const directions = [
    { q: 1, r: 0, s: -1 },
    { q: 1, r: -1, s: 0 },
    { q: 0, r: -1, s: 1 },
    { q: -1, r: 0, s: 1 },
    { q: -1, r: 1, s: 0 },
    { q: 0, r: 1, s: -1 },
  ];
  
  return directions.map(d => ({
    q: coord.q + d.q,
    r: coord.r + d.r,
    s: coord.s + d.s,
  }));
}
