import React from "react";
import {generateHexes, HexNode} from "./hexUtils";
import {generateIntersections, connectIntersections, IntersectNode} from "./intersectUtils";
import {PlayerObj} from "./playerUtils";
export interface GameState {
    GameBoard: GameBoard;
    players: PlayerObj[];
}

export interface GameBoard {
    hexMap: Map<number , HexNode>;
    intersectMap: Map<number , IntersectNode>;
}
export const generateGameBoard = (boardRadius: number, hexSize: number):GameBoard => {
    let hexes = generateHexes(boardRadius);
    let intersections = generateIntersections(hexes, hexSize);
    intersections = connectIntersections(intersections, hexSize);
    let hexMap:Map<number , HexNode> = hexes.reduce((map, hex) => { map.set(hex.id, hex); return map; }, new Map<number, HexNode>());
    let intersectMap:Map<number , IntersectNode> = intersections.reduce((map, intersect) => { map.set(intersect.id, intersect); return map; }, new Map<number, IntersectNode>());
    return {hexMap, intersectMap};

}

export type UiEvent = "buildSettlement" | "buildRoad" | "endTurn" | "rollDice" | "trade" | "buyDevCard" | "playDevCard";

export type UiEventPayload = buildSettlementPayload;
export interface buildSettlementPayload {
    intersectId: number;
}