import { ResourceCount } from './Logic';
import { DevelopmentCardType } from './DevelopmentCard';

export interface Player {
  id: string;
  name: string;
  color: string;
  resources: ResourceCount;
  /** Development cards held by this player (face-up in the UI). */
  developmentCards: DevelopmentCardType[];
  /** Victory points earned from victory point cards and other sources. */
  victoryPoints: number;
  /** Free roads remaining (from a played Road Building card). */
  freeRoadsLeft: number;
  /** Dev cards bought this turn (cannot be played until next turn). */
  devCardsBoughtThisTurn: number;
  /**
   * Resources given to the bank per type this turn (enforces the official
   * "at most 4 of one resource type per turn" bank-trade limit).
   */
  bankTradesThisTurn: ResourceCount;
  /**
   * Server-issued secret used to re-attach to this seat on reconnect. Never
   * sent to other players; it proves ownership of the seat (a name alone must
   * not let a stranger take over a player mid-game).
   */
  token?: string;
  /**
   * Public hand size seen by other players (their `resources` are masked).
   * Always present on the sanitized view; equals the real hand size.
   */
  resourceCount?: number;
  /**
   * Public dev-card count seen by other players (their card list is masked).
   * Always present on the sanitized view.
   */
  devCardCount?: number;
}
