import { PixelCoord, VertexId, EdgeId, SettlementId, RoadId } from './Board';

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
  id: string;
  position: PixelCoord;
  terrain: string;
  rollNumber: number | null;
  hasRobber: boolean;
  vertexIds: VertexId[];
  edgeIds: EdgeId[];
}

export interface BoardUIState {
  vertices: Record<VertexId, BoardVertex>;
  edges: Record<EdgeId, BoardEdge>;
  hexes: Record<string, BoardHex>;
  selectedVertexId: VertexId | null;
  selectedEdgeId: EdgeId | null;
  hoveredVertexId: VertexId | null;
  hoveredEdgeId: EdgeId | null;
  buildMode: 'settlement' | 'road' | 'none';
  canBuildSettlement: boolean;
  canBuildRoad: boolean;
}

export interface BoardUIProps {
  board: BoardUIState;
  onVertexClick: (vertexId: VertexId) => void;
  onEdgeClick: (edgeId: EdgeId) => void;
  onVertexHover: (vertexId: VertexId | null) => void;
  onEdgeHover: (edgeId: EdgeId | null) => void;
  players: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}
