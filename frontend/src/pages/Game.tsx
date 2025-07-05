import React from 'react';
import {Player} from '../types/player';
import {GameRoom} from '../types/game';
import Game from '../containers/Game';
const GamePage: React.FC<{
    gameRoom: GameRoom;
    currentPlayer: Player | null;
    onMakeMove: (position: number) => void;
    onResetGame: () => void;
    onLeaveRoom: () => void;
    error: string | null;
}> = ({ gameRoom, currentPlayer, onMakeMove, onResetGame, onLeaveRoom, error }) => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-center mb-6">Game Page</h1>
            <p className="text-center text-gray-600">This is where the game will be played.</p>
            <Game/>
        </div>
        </div>
    );
    }

export default GamePage;

