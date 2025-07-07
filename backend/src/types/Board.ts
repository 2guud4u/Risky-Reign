// import { Road, Settlement, Soldier } from "./Pieces";
// import Player  from "./Player";

export interface Board{
    // HexMap: Map<number, HexNode>;
    // IntersectionMap: Map<string, Intersection>;
    // RoadMap: Map<string, Road>;
    // Settlements: SettlementObj[];
    // Roads: RoadObj[];
    // Soldiers: SoldierObj[];
    // Roll: string;
    // RollMap: Map<string, number[]>; 
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






