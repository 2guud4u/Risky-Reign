import { CubeCoord, PixelCoord } from './Coordinates';

export type HexId = string;
export type VertexId = string;
export type EdgeId = string;
export type SettlementId = string;
export type RoadId = string;

export interface HexNode {
  id: HexId;
  coord: CubeCoord;
  terrain: string;
  rollNumber: number | null;
  robber: boolean;
}

export interface VertexNode {
  id: VertexId;
  position: PixelCoord;
  hexIds: string[]; // 2-3 hexes adjacent to this vertex
  settlementId: SettlementId | null;
  roadIds: EdgeId[];
}

export interface EdgeNode {
  id: EdgeId;
  vertexAId: VertexId;
  vertexBId: VertexId;
  hexIds: string[]; // 1-2 hexes adjacent to this edge
  roadId: RoadId | null;
}

export interface SettlementObj {
  id: SettlementId;
  vertexId: VertexId;
  ownerId: string;
  level: 'settlement' | 'city';
  builtAt: number;
}

export interface RoadObj {
  id: RoadId;
  edgeId: EdgeId;
  ownerId: string;
  builtAt: number;
}

export interface Board {
  hexes: Record<HexId, HexNode>;
  vertices: Record<VertexId, VertexNode>;
  edges: Record<EdgeId, EdgeNode>;
  settlements: Record<SettlementId, SettlementObj>;
  roads: Record<RoadId, RoadObj>;
  metadata: {
    id: string;
    version: number;
    lastUpdated: number;
    generator: string;
  };
}
