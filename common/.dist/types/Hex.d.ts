import { CubeCoord } from './Board';
export type Resource = 'Wheat' | 'Sheep' | 'Ore' | 'Brick' | 'Wood' | 'Nothing';
export type Terrain = Resource | ('Water' | 'Desert');
export type HexId = number;
export declare const TerrainResourceMap: {
    [key in Terrain]: Resource;
};
export interface HexProps {
    terrain: Terrain;
    robber: boolean;
    rollNumber: number | null;
}
export interface HexNode {
    id: number;
    coord: CubeCoord;
    intersections: Set<number>;
    terrain: Terrain;
    robber: boolean;
    rollNumber: number | null;
}
export declare function getRollMap(hexes: HexNode[]): Map<string, number[]>;
export declare const terrainColors: {
    [key: string]: string;
};
export declare const generateHexes: (boardRadius: number) => HexNode[];
