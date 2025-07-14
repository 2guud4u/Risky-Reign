export interface TurnState {
    phase: 'SetUp' | 'Dice' | 'Trade' | 'Build' | 'Action';
    player: string;
    playerOrder: string[];
    offset: number;
}
import { HexNode, HexId } from './Hex';
import { IntersectNode, IntersectId } from './Board';
import { Player } from './Player';
export interface GameState {
    GameBoard: GameBoard;
    players: Player[];
}
export interface GameBoard {
    hexMap: Map<HexId, HexNode>;
    intersectMap: Map<IntersectId, IntersectNode>;
}
export declare const generateGameBoard: (boardRadius: number, hexSize: number) => GameBoard;
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
