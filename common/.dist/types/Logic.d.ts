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
import { HexNode } from './Hex';
import { IntersectNode } from './Board';
export declare const generateGameBoard: (boardRadius: number, hexSize: number) => {
    hexes: Array<HexNode>;
    intersections: Array<IntersectNode>;
};
export interface ResourceCount {
    Wood: number;
    Brick: number;
    Sheep: number;
    Wheat: number;
    Ore: number;
}
export interface Price extends ResourceCount {
}
export declare const SettlementPrice: Price;
export declare const RoadPrice: Price;
export declare const SoldierPrice: Price;
