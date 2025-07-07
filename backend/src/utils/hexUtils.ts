import { CubeCoord } from './helperUtils';
import { shuffleArray, flattenAndFillObject } from './helperUtils';
export type Resource = 'Wheat' | 'Sheep' | 'Ore' | 'Brick' | 'Wood' | 'Nothing';
export type Terrain = Resource | ('Water' | 'Desert');

export type HexId = number;
let numTokens: { [key in number]: number } = {
    2: 1,
    3: 2,
    4: 2,
    5: 2,
    6: 2,
    8: 2,
    9: 2,
    10: 2,
    11: 2,
    12: 1,
};

let terrains: { [key in Terrain]: number } = {
    Wheat: 4,
    Sheep: 4,
    Ore: 3,
    Desert: 1,
    Brick: 3,
    Wood: 4,
    Water: 0,
    Nothing: 0,
};

export const TerrainResourceMap: { [key in Terrain]: Resource } = {
    Wheat: 'Wheat',
    Sheep: 'Sheep',
    Ore: 'Ore',
    Brick: 'Brick',
    Wood: 'Wood',
    Water: 'Nothing',
    Desert: 'Nothing',
    Nothing: 'Nothing',
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
export function getRollMap(hexes: HexNode[]): Map<string, number[]> {
    let rollMap = new Map();
    hexes.forEach((hex) => {
        if (hex.rollNumber !== null) {
            if (rollMap.has(hex.rollNumber)) {
                (rollMap.get(hex.rollNumber) as number[]).push(hex.id);
            } else {
                rollMap.set(hex.rollNumber, [hex.id]);
            }
        }
    });

    return rollMap;
}

export const terrainColors: { [key: string]: string } = {
    Wood: '#228B22',
    Sheep: '#7CFC00',
    Wheat: '#FFD700',
    Brick: '#CD853F',
    Ore: '#A9A9A9',
    Desert: '#F4A460',
    Water: '#00FFFF',
};

export const generateHexes = (boardRadius: number): HexNode[] => {
    const hexes: HexNode[] = [];
    let TerrainList = shuffleArray(flattenAndFillObject(terrains));
    let tokenList = shuffleArray(flattenAndFillObject(numTokens));
    let id = 0;
    for (let q = -boardRadius; q <= boardRadius; q++) {
        for (let r = Math.max(-boardRadius, -q - boardRadius); r <= Math.min(boardRadius, -q + boardRadius); r++) {
            const s = -q - r;
            let terrain = TerrainList.pop() as Terrain;
            if (!terrain) {
                terrain = 'Water';
            }
            if (terrain === 'Desert') {
                hexes.push({
                    id: id,
                    intersections: new Set(),
                    coord: { q, r, s },
                    terrain: terrain,
                    robber: true,
                    rollNumber: null,
                });
            } else {
                const token = tokenList.pop() as number;
                hexes.push({
                    id: id,
                    intersections: new Set(),
                    coord: { q, r, s },
                    terrain: terrain,
                    robber: false,
                    rollNumber: token,
                });
            }
            id += 1;
        }
    }

    return hexes;
};
