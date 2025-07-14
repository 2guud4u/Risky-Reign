import { SettlementObj, SoldierObj, RoadObj } from "./Pieces";
import { HexNode } from "./Hex";
export interface Board {
    HexMap: Map<number, HexNode>;
    IntersectionMap: Map<number, IntersectNode>;
    Settlements: SettlementObj[];
    Roads: RoadObj[];
    Soldiers: SoldierObj[];
    Roll: string;
    RollMap: Map<string, number[]>;
}
export interface CubeCoord {
    q: number;
    r: number;
    s: number;
}
export interface PixelCoord {
    x: number;
    y: number;
}
export interface Intersect extends PixelCoord {
}
export type IntersectId = number;
export interface IntersectNode {
    coord: PixelCoord;
    intersections: Set<number>;
    id: number;
    settlement: number | null;
    soldiers: SoldierObj[];
    roads: Set<number>;
}
export declare const generateIntersections: (hexes: HexNode[], size: number) => IntersectNode[];
export declare function connectIntersections(intersections: IntersectNode[], hexSize: number): IntersectNode[];
export declare function calculateHexagonVertices(q: number, r: number, s: number, size: number): PixelCoord[];
export declare function getIntersectByIndex(key: number, intersects: Intersect[]): Intersect;
export interface Coords {
    x: number;
    y: number;
    z: number;
}
