import { SoldierObj } from './Pieces';

/**
 * Turn / trade / battle state types. Types only — the price constants and
 * `canAfford` live in `utils/logic.ts`.
 */

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
