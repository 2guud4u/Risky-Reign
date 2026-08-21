import { Player } from './Player';
import { BattleState, TradeOffer, TurnState, RollResult } from './Logic';
import { Board } from './Board';

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
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  roll: RollResult;
}
