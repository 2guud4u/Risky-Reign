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
}
