import { SoldierObj } from './Pieces';
import { Resource } from './Hex';

/**
 * Turn / trade / battle state types. Types only — the price constants and
 * `canAfford` live in `utils/logic.ts`.
 */

export interface TurnState {
  phase: 'SetUp' | 'Dice' | 'Build' | 'Action';
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
  /** Players who already fought the robber this Action phase (once per player per phase). */
  robberFoughtThisPhase: string[];
  /** Undoable actions taken by the acting player this phase (cleared on every advance). */
  undoLog: UndoEntry[];
}

/**
 * One undoable action by the acting player. Each entry captures exactly what
 * is needed to reverse that action. The log is cleared on every `advanceTurn`,
 * so it holds only the current acting player's current-phase actions — which
 * is precisely the "lock out once my turn ends" rule.
 */
export type UndoEntry =
  | {
      kind: 'buildSettlement';
      settlementId: string;
      /** Garrisoned soldier spawned with the settlement (deleted on undo). */
      soldierId: string;
      vertexId: string;
      /** True if the settlement cost was deducted (Build phase, not free setup). */
      paid: boolean;
    }
  | {
      kind: 'buildRoad';
      roadId: string;
      edgeId: string;
      /** True if a free road (Road Building card) was used instead of resources. */
      usedFreeRoad: boolean;
      /** True if the road cost was deducted (Build phase, not free setup). */
      paid: boolean;
    }
  | {
      kind: 'upgradeCity';
      settlementId: string;
      /** Extra garrisoned soldier spawned by the upgrade (deleted on undo). */
      soldierId: string;
    }
  | {
      kind: 'recruitSoldier';
      soldierId: string;
    }
  | {
      kind: 'moveSoldier';
      soldierId: string;
      /** The vertex the soldier was on before the move (restored on undo). */
      originalVertexId: string;
    }
  | {
      kind: 'captureSettlement';
      settlementId: string;
      /** The owner before the capture (restored on undo). */
      originalOwnerId: string;
      /** The soldiers that performed the capture (their actions are refunded on undo). */
      soldierIds: string[];
    }
  | {
      kind: 'fightRobber';
      /** The player who fought (their once-per-phase fight is refunded on undo). */
      playerName: string;
      soldierId: string;
      /** The fight outcome. */
      result: 'win' | 'lose';
      /** The soldier as it was before the fight (restored on undo if it was killed). */
      soldierSnapshot: SoldierObj;
      /** The robber bag before the fight (restored on undo if the player won). */
      bagBefore: ResourceCount;
    };

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
/** Result of a trade-eligibility check. */
export interface TradeCheck {
  allowed: boolean;
  reason: string | null;
}

/** A single resource grant produced by a dice payout. */
export interface Payout {
  playerName: string;
  resource: Exclude<Resource, 'Nothing'>;
  amount: number;
}
/**
 * Result of a dice payout computation: the grants players receive, and the
 * resources diverted to the robber's bag (hexes the robber sits on).
 */
export interface PayoutResult {
  /** Grants to players (settlement = 1, city = 2 of the hex's resource). */
  payouts: Payout[];
  /** Resources collected by the robber (robbed hexes), by type. */
  robbed: ResourceCount;
}

/** Result of a build-eligibility check. */
export interface BuildCheck {
  allowed: boolean;
  reason: string | null;
}
