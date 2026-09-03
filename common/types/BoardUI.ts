import type { EdgeId, HexId, VertexId, PortType } from './Board';
import { PixelCoord } from './Coordinates';

/**
 * Presentation layer (UI-optimized). Produced by the adapter from the domain
 * Board; no domain types leak into the components beyond these.
 */

export interface BoardVertex {
  id: VertexId;
  position: PixelCoord;
  isSelectable: boolean;
  hasSettlement: boolean;
  settlementLevel: 'none' | 'settlement' | 'city';
  settlementOwnerId: string | null;
  adjacentEdgeIds: EdgeId[];
  adjacentVertexIds: VertexId[];
  isHovered: boolean;
  isSelected: boolean;
  /** Trade port (harbor) at this vertex: null, generic (3:1), or a special resource (2:1). */
  port: PortType | null;
}

export interface BoardEdge {
  id: EdgeId;
  start: PixelCoord;
  end: PixelCoord;
  hasRoad: boolean;
  roadOwnerId: string | null;
  isSelectable: boolean;
  isHovered: boolean;
  isSelected: boolean;
}

export interface BoardHex {
  id: HexId;
  position: PixelCoord;
  terrain: string;
  rollNumber: number | null;
  hasRobber: boolean;
  vertexIds: VertexId[];
  edgeIds: EdgeId[];
}

export type BuildMode = 'settlement' | 'road' | 'none';

export interface BoardUIState {
  vertices: Record<VertexId, BoardVertex>;
  edges: Record<EdgeId, BoardEdge>;
  hexes: Record<HexId, BoardHex>;
  selectedVertexId: VertexId | null;
  selectedEdgeId: EdgeId | null;
  hoveredVertexId: VertexId | null;
  hoveredEdgeId: EdgeId | null;
  buildMode: BuildMode;
  roadStartVertexId: VertexId | null;
  validVertexIds: VertexId[];
  validEdgeIds: EdgeId[];
  canBuildSettlement: boolean;
  canBuildRoad: boolean;
}
