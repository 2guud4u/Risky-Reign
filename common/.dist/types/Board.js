"use strict";
exports.__esModule = true;
exports.getIntersectByIndex = exports.calculateHexagonVertices = exports.connectIntersections = exports.generateIntersections = void 0;
var data_1 = require("../utils/data");
var generateIntersections = function (hexes, size) {
    var intersects = [];
    var id = 0;
    hexes.forEach(function (hex, index) {
        var _a = hex.coord, q = _a.q, r = _a.r, s = _a.s;
        var hexagonVertices = calculateHexagonVertices(q, r, s, size);
        hexagonVertices.forEach(function (vertex) {
            var intersect = intersects.find(function (_a) {
                var coord = _a.coord;
                return (0, data_1.calcEuclideanDistance)(vertex, coord) < 1;
            });
            if (!intersect) {
                intersect = {
                    id: id,
                    coord: vertex,
                    intersections: new Set(),
                    settlement: null,
                    soldiers: [],
                    roads: new Set()
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
exports.generateIntersections = generateIntersections;
function connectIntersections(intersections, hexSize) {
    var connectedIntersections = [];
    intersections.forEach(function (intersect) {
        var coord = intersect.coord;
        intersections.forEach(function (otherIntersect) {
            if (intersect.id !== otherIntersect.id && (0, data_1.calcEuclideanDistance)(coord, otherIntersect.coord) < hexSize * 1.1) {
                intersect.intersections.add(otherIntersect.id);
            }
        });
        connectedIntersections.push(intersect);
    });
    return connectedIntersections;
}
exports.connectIntersections = connectIntersections;
function calculateHexagonVertices(q, r, s, size) {
    var intersects = [];
    var _a = (0, data_1.cubeToPixel)({ q: q, r: r, s: s }, size), x = _a.x, y = _a.y;
    var hexPoints = [
        [0, -1],
        [Math.sqrt(3) / 2, -0.5],
        [Math.sqrt(3) / 2, 0.5],
        [0, 1],
        [-Math.sqrt(3) / 2, 0.5],
        [-Math.sqrt(3) / 2, -0.5],
    ].map(function (_a) {
        var px = _a[0], py = _a[1];
        return [px * size + x, py * size + y];
    });
    hexPoints.forEach(function (_a) {
        var px = _a[0], py = _a[1];
        intersects.push({ x: px, y: py });
    });
    return intersects;
}
exports.calculateHexagonVertices = calculateHexagonVertices;
function getIntersectByIndex(key, intersects) {
    return intersects[key];
}
exports.getIntersectByIndex = getIntersectByIndex;
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
