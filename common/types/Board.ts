import { CubeCoord, PixelCoord } from './Coordinates';
import { SoldierObj } from './Pieces';

/**
 * Domain layer. Shape-agnostic: works for ANY hex layout, not just the
 * standard 19-hex board. All ids are strings derived from coordinates
 * (see Coordinates.ts for the canonicalization spec).
 */

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
  /** 1-3 hexes that meet at this vertex (1 = board boundary). */
  hexIds: HexId[];
  settlementId: SettlementId | null;
  roadIds: EdgeId[];
}

export interface EdgeNode {
  id: EdgeId;
  vertexAId: VertexId;
  vertexBId: VertexId;
  /** 1-2 hexes on either side (1 = board boundary). */
  hexIds: HexId[];
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
  soldiers: Record<string, SoldierObj>;
  metadata: {
    id: string;
    version: number;
    lastUpdated: number;
    generator: string;
  };
}
