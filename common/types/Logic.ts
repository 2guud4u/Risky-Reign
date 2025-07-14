import { SoldierObj } from './Pieces';
export interface TurnState {
    phase: 'SetUp' | 'Dice' | 'Trade' | 'Build' | 'Action';
    player: string;
    playerOrder: string[];
    offset: number;
}

export interface TradeState {
    id: string;
    trader: TradeParty;
    tradee: TradeParty;
}

export interface TradeParty {
    name: string;
    offer: Price;
    accept: boolean | null;
}
export interface BattleState {
    states: Map<string, { soldiers: SoldierBattleState[]; submitted: boolean }>;

    intersectId: number;
}
export interface SoldierBattleState {
    soldier: SoldierObj;
    rollNum: number;
    dead: boolean;
}

import { generateHexes, HexNode, HexId } from './Hex';
import { connectIntersections, generateIntersections, IntersectNode, IntersectId } from './Board';
import { Player } from './Player';



export const generateGameBoard = (boardRadius: number, hexSize: number): {hexes: Array<HexNode>, intersections: Array<IntersectNode>} => {
    let hexes = generateHexes(boardRadius);
    let intersections = generateIntersections(hexes, hexSize);
    intersections = connectIntersections(intersections, hexSize);
    return {hexes, intersections} ;
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
