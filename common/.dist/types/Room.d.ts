import { Player } from './Player';
import { TurnState, TradeState } from './Logic';
import { Board } from './Board';
export interface GameRoom {
    id: string;
    players: Player[];
    board: Board | null;
    turnState: TurnState;
    tradeStates: TradeState[];
    gameStatus: 'waiting' | 'playing' | 'finished';
    winner: string | null;
    roll: string;
}
