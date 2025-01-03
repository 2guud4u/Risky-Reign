import { generateHexes, HexNode, HexId } from './hexUtils';
import { connectIntersections, generateIntersections, IntersectNode, IntersectId } from './intersectUtils';
import { PlayerObj } from './playerUtils';
import { BattleState, SoldierObj, SoldierBattleState } from '../utils/soldierUtils';
export interface GameState {
    GameBoard: GameBoard;
    players: PlayerObj[];
}

export interface GameBoard {
    hexMap: Map<HexId, HexNode>;
    intersectMap: Map<IntersectId, IntersectNode>;
}
export const generateGameBoard = (boardRadius: number, hexSize: number): GameBoard => {
    let hexes = generateHexes(boardRadius);
    let intersections = generateIntersections(hexes, hexSize);
    intersections = connectIntersections(intersections, hexSize);
    let hexMap: Map<number, HexNode> = hexes.reduce((map, hex) => {
        map.set(hex.id, hex);
        return map;
    }, new Map<number, HexNode>());
    let intersectMap: Map<number, IntersectNode> = intersections.reduce((map, intersect) => {
        map.set(intersect.id, intersect);
        return map;
    }, new Map<number, IntersectNode>());
    return { hexMap, intersectMap };
};

export interface ResourceCount {
    Wood: number;
    Brick: number;
    Sheep: number;
    Wheat: number;
    Ore: number;
}

export interface Price extends ResourceCount {}

export const SettlementPrice: Price = {
    Wood: 1,
    Brick: 1,
    Sheep: 1,
    Wheat: 1,
    Ore: 0,
};

export const RoadPrice: Price = {
    Wood: 1,
    Brick: 1,
    Sheep: 0,
    Wheat: 0,
    Ore: 0,
};

export const SoldierPrice: Price = {
    Wood: 0,
    Brick: 1,
    Sheep: 1,
    Wheat: 1,
    Ore: 0,
};
