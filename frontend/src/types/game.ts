import { Player } from './player';

export interface GameRoom {
  id: string;
  players: Player[];
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: string | null;
}

