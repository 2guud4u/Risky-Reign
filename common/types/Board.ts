import { Road, SettlementObj, SoldierObj, RoadObj } from "./Pieces";
// import Player  from "./Player";
import { HexNode } from "./Hex";
import { cubeToPixel, calcEuclideanDistance } from '../utils/data';

export interface Board{
    Hexes: Array<HexNode>;
    Intersections: Array<IntersectNode>;
    Settlements: SettlementObj[];
    Roads: RoadObj[];
    Soldiers: SoldierObj[];
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

export interface Intersect extends PixelCoord {}
export type IntersectId = number;

export interface IntersectNode {
    coord: PixelCoord;
    intersections: Set<number>;
    id: number;
    settlement: number | null;
    soldiers: SoldierObj[];
    roads: Set<number>;
}

export const generateIntersections = (hexes: HexNode[], size: number): IntersectNode[] => {
    const intersects: IntersectNode[] = [];
    let id = 0;
    hexes.forEach((hex, index) => {
        const { q, r, s } = hex.coord;
        const hexagonVertices = calculateHexagonVertices(q, r, s, size);
        hexagonVertices.forEach((vertex) => {
            let intersect = intersects.find(({ coord }) => calcEuclideanDistance(vertex, coord) < 1);
            if (!intersect) {
                intersect = {
                    id: id,
                    coord: vertex,
                    intersections: new Set(),
                    settlement: null,
                    soldiers: [],
                    roads: new Set(),
                };
                id++;
            }
            hex.intersections.add(intersect.id);
            intersects.push(intersect);
        });
        //add intersections to hex
    });
    return intersects;
};

export function connectIntersections(intersections: IntersectNode[], hexSize: number): IntersectNode[] {
    let connectedIntersections: IntersectNode[] = [];
    intersections.forEach((intersect) => {
        const { coord } = intersect;
        intersections.forEach((otherIntersect) => {
            if (intersect.id !== otherIntersect.id && calcEuclideanDistance(coord, otherIntersect.coord) < hexSize * 1.1) {
                intersect.intersections.add(otherIntersect.id);
            }
        });
        connectedIntersections.push(intersect);
    });
    return connectedIntersections;
}

export function calculateHexagonVertices(q: number, r: number, s: number, size: number): PixelCoord[] {
    const intersects: PixelCoord[] = [];
    const { x, y } = cubeToPixel({ q, r, s }, size);

    const hexPoints = [
        [0, -1],
        [Math.sqrt(3) / 2, -0.5],
        [Math.sqrt(3) / 2, 0.5],
        [0, 1],
        [-Math.sqrt(3) / 2, 0.5],
        [-Math.sqrt(3) / 2, -0.5],
    ].map(([px, py]) => [px * size + x, py * size + y]);

    hexPoints.forEach(([px, py]) => {
        intersects.push({ x: px, y: py });
    });

    return intersects;
}

export function getIntersectByIndex(key: number, intersects: Intersect[]): Intersect {
    return intersects[key];
}


// export type Resource = "Wheat" | "Sheep" | "Ore" | "Desert" | "Brick" | "Wood";

// export interface Tile {
//    Resource: Resource;
//    RollNumber: number;
//    Robber: boolean;
// }

// export class TileImpl implements Tile {
//     Resource: Resource;
//     RollNumber: number;
//     Robber: boolean;
//     constructor(Resource: Resource, RollNumber: number, Robber: boolean){
//         this.Resource = Resource;
//         this.RollNumber = RollNumber;
//         this.Robber = Robber;
//     }
// }

// export interface Intersection{
//     Settlement: Settlement | null;
//     Soldiers: Soldier[];
//     Port: Map<Resource, number> | null;
// }

// export class IntersectionImpl implements Intersection {
//     Settlement: Settlement;
//     Soldiers: Soldier[];
//     Port: Map<Resource, number> | null;
//     constructor(Settlement: Settlement, Soldiers: Soldier[], Port: Map<Resource, number> | null){
//         this.Settlement = Settlement;
//         this.Soldiers = Soldiers;
//         this.Port = Port;
//     }
// }

export interface Coords {
    x: number;
    y: number;
    z: number;
}


// export type Phase = "setup" | "lobby" | "action" | "trade" | "build" | "diceRoll";

// export interface Game {
//     id: string;
//     board: Map<string, Tile | Intersection>;
//     players: Player[];
//     roads: Road[];
//     turnIndex: number;
//     tokenMap: Map<string, string[]>;
//     phase: Phase;
    

// }

// // export class GameImpl implements Game {
// //     board: Map<string, Tile | Intersection>;
// //     players: Player[];
// //     roads: Road[];
// //     turnIndex: number;
// //     phase: Phase;
// //     tokenMap: Map<number, string[]>;

// //     constructor(,board: Map<string, Tile | Intersection>,tokenMap:  Map<number, string[]>, phase: Phase){
// //         this.board = board;
// //         this.players = [];
// //         this.roads = [];
// //         this.turnIndex = 0;
// //         this.phase = phase;
// //         this.tokenMap = tokenMap;


// //     }

// //     lookupCoords(coords: string): Tile | Intersection | undefined {
// //         return this.board.get(coords);
// //     }

// //     updateCoords(coords: string, value: Tile | Intersection): void {
// //         this.board.set(coords, value);
// //     }
// //     addPlayer(player: Player): void {
// //         this.players.push(player);
// //     }

// // }






