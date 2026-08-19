import { SoldierObj } from './Pieces';

export interface TurnState {
  phase: 'SetUp' | 'Dice' | 'Trade' | 'Build' | 'Action';
  player: string;
  playerOrder: string[];
  offset: number;
  dicePlayerIndex: number;
  placedSettlement: boolean | null;
  placedRoad: boolean | null;
}

export interface TradeParty {
  name: string;
  offer: Price;
  accept: boolean | null;
}

export interface TradeState {
  id: string;
  trader: TradeParty;
  tradee: TradeParty;
}

export interface SoldierBattleState {
  soldier: SoldierObj;
  rollNum: number;
  dead: boolean;
}

export interface BattleState {
  states: Record<string, { soldiers: SoldierBattleState[]; submitted: boolean }>;
  vertexId: string;
}

export interface ResourceCount {
  Wood: number;
  Brick: number;
  Sheep: number;
  Wheat: number;
  Ore: number;
}

export interface Price extends ResourceCount {}

export const SettlementPrice: Price = { Wood: 1, Brick: 1, Sheep: 1, Wheat: 1, Ore: 0 };
export const RoadPrice: Price = { Wood: 1, Brick: 1, Sheep: 0, Wheat: 0, Ore: 0 };
export const SoldierPrice: Price = { Wood: 0, Brick: 1, Sheep: 1, Wheat: 1, Ore: 0 };

/** Whether a player's resources can cover the (positive) price. */
export function canAfford(resources: ResourceCount, price: Price): boolean {
  return (Object.keys(price) as (keyof Price)[]).every((k) => resources[k] >= price[k]);
}
