import { EdgeId, SettlementId, VertexId } from './Board';

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

const buildTypes = ['Settlement', 'Road', 'City', 'Soldier'] as const;
export type BuildType = (typeof buildTypes)[number];

export const isBuildType = (arg: unknown): arg is BuildType =>
  (buildTypes as readonly string[]).includes(arg as string);

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
