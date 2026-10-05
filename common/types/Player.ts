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
  /**
   * Knocked out of the game (no settlements, cities, or soldiers left). An
   * eliminated player gets no more turns but stays in the room to spectate.
   */
  eliminated: boolean;
  /**
   * Whether this seat has a live socket. False after its browser disconnects
   * (closed tab, lost link): the seat is kept and anyone opening the room
   * link can reclaim it from the rejoin picker.
   */
  connected: boolean;
  /** Free roads remaining (from a played Road Building card). */
  freeRoadsLeft: number;
  /** Dev cards bought this turn (cannot be played until next turn). */
  devCardsBoughtThisTurn: number;
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
