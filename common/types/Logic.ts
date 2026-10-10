import { SoldierObj } from './Pieces';
import { Resource } from './Hex';

/**
 * Turn / trade / battle state types. Types only — the price constants and
 * `canAfford` live in `utils/logic.ts`.
 */
/**
 * How a Build or Action phase is scoped within a dice round:
 * - 'around' — every player takes that phase in turn order (the dice player
 *   first), then the next phase begins (the Expanded rules).
 * - 'single' — only the dice player takes that phase; the phase ends as soon
 *   as they pass, so the game moves straight on (regular Catan's "roll →
 *   build → act, then the next player rolls").
 */
export type PhaseScope = 'single' | 'around';

/** A room's chosen turn structure: independent scope for Build and Action. */
export interface TurnMode {
  build: PhaseScope;
  action: PhaseScope;
  /**
   * After an 'around' Build phase, the round's dice player rolls again
   * (a second Dice phase with its own payouts) before the Action phase.
   * Ignored when `build` is 'single'.
   */
  secondRoll: boolean;
}

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
      /** The soldier that performed the capture (its action is refunded on undo). */
      soldierId: string;
      /** Roads that transferred to the capturer (ownership restored on undo). */
      roadTransfers: { roadId: string; originalOwnerId: string }[];
    };

/** A pending resource trade between two players (or an open offer to anyone). */
export interface TradeOffer {
  id: string;
  from: string; // player who created the offer
  to: string | null; // recipient, or null for an open offer anyone may take
  give: Price; // resources 'from' offers to hand over
  want: Price; // resources 'from' requests in return
  /** The player who took an open offer, awaiting the creator's decision. */
  claimer?: string | null;
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
   * True while the injured defenders roll off against the attacker's
   * survivors (Rules.md lines 9, 30): set when the target vertex held only
   * injured enemy troops, or when a mixed group's last healthy defender fell
   * mid-battle. Injured defenders DO roll (unlike a normal battle, where
   * injured troops are out of the fight). Resolution is a roll-off: if the
   * injured defender rolls higher they flee (stay injured, can move);
   * otherwise they die.
   */
  injuredFight?: boolean;
  /**
   * Current resting vertex per injured soldier. Present during 'repositioning'
   * — it records each injured troop's board position so the UI can move them
   * (they start at the battle vertex and MUST move one road-step to a
   * neighboring vertex, unless the battle vertex has no road out).
   */
  injuredSettled?: Record<string, string>;
  /**
   * True when this battle is a 1v1 fight against the robber (the "defender"
   * is the robber, auto-rolled). The outcome is a single roll-off: the
   * attacker wins only on a strictly higher roll (the robber wins ties).
   */
  robberFight?: boolean;
  /**
   * Whose repositioning turn it is during the 'repositioning' phase: the
   * attacker moves their injured troops away first, then the defender
   * (Rules.md: "attacker gets to move injured soldiers away first").
   * A side with no injured troops is auto-skipped; null once both sides
   * are done (or had nothing to reposition).
   */
  repositionTurn?: 'attacker' | 'defender' | null;
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
