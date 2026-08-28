import { Player } from './Player';
import { BattleState, TradeOffer, TurnState, RollResult } from './Logic';
import { Board } from './Board';
import { DevelopmentCardType } from './DevelopmentCard';

/**
 * Wire protocol: the backend now emits the clean domain `Board` directly
 * (string ids, plain Records/arrays — JSON-safe). The new `ui` client consumes
 * `room.board` as-is; no wire adapter is needed.
 */

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
}
