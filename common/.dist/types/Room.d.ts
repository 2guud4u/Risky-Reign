import { Player } from './Player';
import { TurnState } from './Logic';
import { Board } from './Board';
export interface GameRoom {
    id: string;
    players: Player[];
    board: Board | null;
    turnState: TurnState;
    gameStatus: 'waiting' | 'playing' | 'finished';
    winner: string | null;
}
