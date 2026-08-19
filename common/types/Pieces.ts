import { EdgeId, SettlementId, VertexId } from './Board';

/**
 * Piece / placement types. Types only — the `isBuildType` guard lives in
 * `utils/pieces.ts`.
 */

export type SoldierType = 'infantry' | 'cannon';

export interface SoldierObj {
  id: string;
  owner: string;
  injured: boolean;
  vertexId: VertexId;
  type: SoldierType;
  stationed: boolean;
}

export type DevCardType = 'Knight' | 'VictoryPoint' | 'RoadBuilding' | 'YearOfPlenty' | 'Monopoly';

export interface DevCard {
  type: DevCardType;
  used: boolean;
}

export type BuildType = 'Settlement' | 'Road' | 'City' | 'Soldier';

/** A settlement placement request (wire-friendly, string ids). */
export interface SettlementPlacement {
  settlementId: SettlementId;
  vertexId: VertexId;
  ownerId: string;
}

/** A road placement request (wire-friendly, string ids). */
export interface RoadPlacement {
  roadId: string;
  edgeId: EdgeId;
  ownerId: string;
}
