import { Player } from './Player';
import { BattleState, TradeOffer, TurnState, RollResult, ResourceCount } from './Logic';
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
 *  - `battlesWon`       : the player with the most battles won (≥ 3) holds
 *                          Warmonger and earns 2 VP.
 *  - `hasLongestRoad` / `hasLargestArmy` / `hasWarmonger` : whether this
 *                          player currently holds that bonus (at most one
 *                          holder each; a tie keeps it with the current
 *                          holder — you must strictly beat them).
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
  /** Player-vs-player battles won per player (mirrors `GameRoom.battlesWon`). */
  battlesWon: Record<string, number>;
  /** Players currently holding the Warmonger bonus (2 VP). */
  hasWarmonger: Record<string, boolean>;
  /** Victory points from settlements (1 VP) and cities (2 VP), per player. */
  settlementVp: Record<string, number>;
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
/**
 * Pending steal. While set, the thief must resolve it via the `chooseSteal`
 * event: they pick one face-down card from one of `victims`. A 'seven'
 * holds the Dice phase until the steal resolves; a 'knight' is an action
 * (no turn advance).
 */
export interface StealState {
  thief: string;
  /** Names of eligible victims (adjacent to the robber's hex, ≥ 1 card). */
  victims: string[];
  reason: 'seven' | 'knight';
}
/**
 * Pending development-card choice. While set, the named player must resolve
 * it via the `resolveDevCardChoice` event: Year of Plenty picks 2 resources
 * from the bank; Monopoly names 1 resource type (all other players give
 * their cards of that type). The card is held in the hand until resolved.
 */
export interface DevCardChoice {
  player: string;
  card: 'year_of_plenty' | 'monopoly';
  /** Index of the held card in the player's hand. */
  cardIndex: number;
}
/**
 * Pending 7-discards, keyed by player name. While a player's entry is set,
 * they must resolve it via the `resolveDiscard` event: they hand in exactly
 * that many resource cards (half their resource hand, rounded down). A 7
 * holds the Dice phase until every discard is resolved and the robber is
 * moved.
 */
export type DiscardState = Record<string, number>;
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
  /** Victory threshold in VP (the "points to win" setting). */
  pointsToWin: number;
  winner: string | null;
  roll: RollResult;
  /** Pending robber placement (a 7 roll or a played knight card). */
  robberMove: RobberMoveRequest | null;
  /**
   * Set when a player defeats the robber in a fight: the winner must move
   * the robber to any hex adjacent to its current position (via the
   * `moveRobberAfterWin` event) before the Action phase may advance.
   * Cleared when the robber is moved or when the winner leaves the room.
   * (The Action phase cannot advance while this is set.)
   */
  robberDefeatedBy: { playerName: string; fromHexId: string } | null;
  /** Pending steal (the thief picks a face-down card from a victim). */
  steal: StealState | null;
  /** Pending development-card choice (Year of Plenty / Monopoly). */
  devCardChoice: DevCardChoice | null;
  /** Pending 7-discards (players with 8+ resource cards hand in half). */
  discards: DiscardState;
  /**
   * The robber's bag: every resource card discarded by the 7 rule, plus the
   * resources produced by hexes the robber sits on.
   */
  robberBag: ResourceCount;
  /**
   * Remaining bank supply per resource (19 of each at game start — the
   * official 95-card bank). Bank trades and Year of Plenty deplete it.
   */
  bankSupply: ResourceCount;
  /** Recomputed scoring bonuses (longest road / largest army / warmonger). */
  bonuses: RoomBonuses;
  /**
   * Player-vs-player battles won, per player name. Incremented when a battle
   * ends with only one side standing (robber fights don't count). Drives the
   * Warmonger bonus.
   */
  battlesWon: Record<string, number>;
  /** Last activity timestamp (ms). Used to sweep idle rooms and free memory. */
  lastActivityAt: number;
}
/**
 * A player as broadcast to clients: the secret `token` is stripped, and other
 * players' `resources`/`developmentCards` are masked (zeroed/empty) so only
 * the seat owner sees their hand. `resourceCount`/`devCardCount` carry the
 * public totals the UI shows for opponents.
 */
export type PublicPlayer = Omit<Player, 'token' | 'resources' | 'developmentCards'> & {
  resources: Player['resources'];
  developmentCards: Player['developmentCards'];
  resourceCount: number;
  devCardCount: number;
};

/**
 * The room as broadcast to a given client: the shared `devCardDeck` draw order
 * is hidden (only its size is public) and every player is a `PublicPlayer`.
 */
export type PublicGameRoom = Omit<GameRoom, 'players' | 'devCardDeck'> & {
  players: PublicPlayer[];
  /** Face-down cards remaining in the shared deck (order hidden). */
  devCardDeckCount: number;
};
