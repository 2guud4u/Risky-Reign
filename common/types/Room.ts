import { Player } from './Player';
import { BattleState, TradeOffer, TurnState, RollResult } from './Logic';
import { Board } from './Board';
import { DevelopmentCardType } from './DevelopmentCard';

/**
 * Wire protocol: the backend now emits the clean domain `Board` directly
 * (string ids, plain Records/arrays — JSON-safe). The new `ui` client consumes
 * `room.board` as-is; no wire adapter is needed.
 */

/**
 * Room-wide scoring bonuses, keyed by player name. Recomputed from the board
 * on every broadcast (see `utils/score.ts`):
 *  - `longestRoad`      : the single longest continuous road chain (≥ 5 roads)
 *                          earns 2 VP.
 *  - `largestArmy`      : the player with the most soldiers (≥ 3) earns 2 VP.
 *  - `hasLongestRoad` / `hasLargestArmy` : whether this player currently holds
 *                          that bonus (ties break in the player's favor).
 */
export interface RoomBonuses {
  /** Longest continuous road chain per player (0 when the player has no roads). */
  longestRoad: Record<string, number>;
  /** Soldier count per player (0 when the player has no soldiers). */
  largestArmy: Record<string, number>;
  /** Players currently holding the Longest Road bonus (2 VP). */
  hasLongestRoad: Record<string, boolean>;
  /** Players currently holding the Largest Army bonus (2 VP). */
  hasLargestArmy: Record<string, boolean>;
}

/**
 * Pending robber placement. While set, the named player must resolve it via
 * the `moveRobber` event: a 'seven' holds the Dice phase from advancing,
 * and a 'knight' holds the card (and its steal) until the robber is placed.
 */
export interface RobberMoveRequest {
  player: string;
  reason: 'seven' | 'knight';
}
export interface GameRoom {
  id: string;
  players: Player[];
  board: Board | null;
  turnState: TurnState;
  tradeOffers: TradeOffer[];
  battleState: BattleState | null;
  /** Shared face-down development card deck (drawn from in order). */
  devCardDeck: DevelopmentCardType[];
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  roll: RollResult;
  /** Pending robber placement (a 7 roll or a played knight card). */
  robberMove: RobberMoveRequest | null;
  /** Recomputed scoring bonuses (longest road / largest army). */
  bonuses: RoomBonuses;
}
