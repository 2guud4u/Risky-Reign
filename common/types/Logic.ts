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

/** A pending resource trade between two players. */
export interface TradeOffer {
  id: string;
  from: string; // player who created the offer
  to: string; // recipient of the offer
  give: Price; // resources 'from' offers to hand over
  want: Price; // resources 'from' requests in return
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
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

/** Result of a dice roll: each die is 1-6 once rolled, null before it is rolled. */
export interface RollResult {
  die1: number | null;
  die2: number | null;
}
