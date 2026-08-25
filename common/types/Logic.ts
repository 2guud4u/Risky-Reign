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
  /** Soldier IDs that already used their action this Action phase (one action per soldier). */
  soldiersActedThisTurn: string[];
  /** Soldier IDs created this turn (cannot move/attack same turn). */
  soldiersCreatedThisTurn: string[];
  /** Soldier IDs healed this turn (cannot move same turn). */
  soldiersHealedThisTurn: string[];
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
  rollNum: number | null; // null until rolled
  dead: boolean;
  injured: boolean; // set true if this battle round injures them
}

/**
 * Phase of the ongoing battle:
 *  - 'rolling'        : both sides are rolling one die per (living) soldier for the current round.
 *  - 'betweenRounds'  : a round just resolved, both sides still have survivors; the attacker decides
 *                       whether to continue to another round or let the battle end.
 *  - 'repositioning'  : the battle is over; players drag their injured soldiers to adjacent
 *                       vertices (or leave them in place) before dismissing the battle window.
 *  - 'finished'       : the battle window is being dismissed (transient; not broadcast).
 */
export type BattlePhase = 'rolling' | 'betweenRounds' | 'repositioning' | 'finished';

export interface BattleState {
  /** Player name who started the attack. */
  attacker: string;
  /** Player name defending (owner of the settlement). */
  defender: string;
  /** Vertex where combat is taking place. */
  vertexId: string;
  /** Soldiers committed by each side, keyed by player name. */
  states: Record<string, { soldiers: SoldierBattleState[] }>;
  /** Current phase of the battle. */
  phase: BattlePhase;
  /** 1-based round number (increments each time the attacker continues). */
  round: number;
  /**
   * Current resting vertex per injured soldier. Present during 'repositioning'
   * — it records each injured troop's board position so the UI can drag them
   * to an adjacent vertex (they start at the battle vertex and can be moved
   * along a road to a neighboring vertex, or left in place).
   */
  injuredSettled?: Record<string, string>;
}

export interface ResourceCount {
  Wood: number;
  Brick: number;
  Sheep: number;
  Wheat: number;
  Ore: number;
}

export interface Price extends ResourceCount {}

/** A single resource type (Wood | Brick | Sheep | Wheat | Ore). */
export type ResourceKey = keyof Price;

/** Result of a dice roll: each die is 1-6 once rolled, null before it is rolled. */
export interface RollResult {
  die1: number | null;
  die2: number | null;
}
