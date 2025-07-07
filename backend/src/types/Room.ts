import { Player } from './Player';
import { TurnState } from './Logic';
export interface GameRoom {
  id: string;
  players: Player[];
  board: (string | null)[];
  turnState: TurnState;
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: string | null;
}