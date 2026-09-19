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
}
