import { generateHexes, HexNode, HexId } from './hexUtils';
import { connectVertexs, generateVertexs, VertexNode, VertexId } from './vertexUtils';
import { PlayerObj } from './playerUtils';
import { BattleState, SoldierObj, SoldierBattleState } from '../utils/soldierUtils';
export interface GameState {
    GameBoard: GameBoard;
    players: PlayerObj[];
}

export interface GameBoard {
    hexMap: Map<HexId, HexNode>;
    vertexMap: Map<VertexId, VertexNode>;
}
export const generateGameBoard = (boardRadius: number, hexSize: number): GameBoard => {
    let hexes = generateHexes(boardRadius);
    let vertexions = generateVertexs(hexes, hexSize);
    vertexions = connectVertexs(vertexions, hexSize);
    let hexMap: Map<number, HexNode> = hexes.reduce((map, hex) => {
        map.set(hex.id, hex);
        return map;
    }, new Map<number, HexNode>());
    let vertexMap: Map<number, VertexNode> = vertexions.reduce((map, vertex) => {
        map.set(vertex.id, vertex);
        return map;
    }, new Map<number, VertexNode>());
    return { hexMap, vertexMap };
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
    Wood: -1,
    Brick: -1,
    Sheep: -1,
    Wheat: -1,
    Ore: 0,
};

export const RoadPrice: Price = {
    Wood: -1,
    Brick: -1,
    Sheep: 0,
    Wheat: 0,
    Ore: 0,
};

export const SoldierPrice: Price = {
    Wood: 0,
    Brick: -1,
    Sheep: -1,
    Wheat: -1,
    Ore: 0,
};
