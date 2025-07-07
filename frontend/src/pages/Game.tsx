import React from 'react';
import {Player} from '../types/player';
import {GameRoom} from '../types/game';
import Game from '../containers/Game';
const GamePage: React.FC<{
    gameRoom: GameRoom;
    currentPlayer: Player | null;
    onMakeMove: (position: number) => void;
    onResetGame: () => void;
    onStartGame: () => void;
    onLeaveRoom: () => void;
    error: string | null;
}> = ({ gameRoom, currentPlayer, onMakeMove, onResetGame, onStartGame,onLeaveRoom, error }) => {
    const renderWaitingRoom = () => {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
                    <h1 className="text-2xl font-bold text-center mb-6">Waiting for Players</h1>
                    <p className="text-center text-gray-600">Current Room ID: {gameRoom.id}</p>
                    <p className="text-center text-gray-600">Players: {gameRoom.players.map(p => p.name).join(', ')}</p>
                    {error && <p className="text-red-500 text-center mt-4">{error}</p>}
                    <button
                        onClick={onStartGame}
                        className="mt-4 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
                        disabled={gameRoom.players.length < 2}
                    >
                        Start Game
                    </button>
                </div>
            </div>
        );
    };
    return (
        <>
            <h1 className="text-2xl font-bold text-center mb-6">Game Page</h1>
            {gameRoom.gameStatus === 'waiting' ? (
                renderWaitingRoom()
            ) : (
                <Game/>
            )}
            
        </>
    );
    }

export default GamePage;

