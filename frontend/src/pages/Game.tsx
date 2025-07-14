import React from 'react';
import { GameRoom, Player, SoldierObj, LOBBY_HEX_SIZE } from 'common';
import Game from '../containers/Game';
import GameBoard from '../containers/CatanBoard';
const GamePage: React.FC<{
    gameRoom: GameRoom;
    currentPlayer: Player | null;
    onMakeMove: (position: number) => void;
    onResetGame: () => void;
    onStartGame: () => void;
    onLeaveRoom: () => void;
    onRefreshMap: () => void;
    error: string | null;
}> = ({ gameRoom, currentPlayer, onMakeMove, onResetGame, onStartGame,onLeaveRoom, onRefreshMap, error }) => {
    const renderWaitingRoom = () => {
        const gameBoard = gameRoom.board;
        if (!gameBoard) {
            return <p className="text-center text-gray-600">Game board is not available
            </p>;
        }
        const exhaustedSoldiers = [] as string[];
        const hexes = gameBoard.Hexes;
        const intersections = gameBoard.Intersections;
        const settlements = gameBoard.Settlements;
        const roads = gameBoard.Roads;
        const players = gameRoom.players;
        const soldiersMap = new Map<number, SoldierObj[]>();
        const UiEventCaller = (UiEvent: string, UiEventPayload: any) => {
            // Handle UI events here
        };


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
                    <GameBoard exhaustedSoldiers={exhaustedSoldiers} hexes={hexes} 
                    intersects={intersections} settlements={settlements} roads={roads} players={players}
                    soldiersMap={soldiersMap} UiEventCaller={UiEventCaller} hexSize={LOBBY_HEX_SIZE}/>
                </div>
            </div>
        );
    };
    const renderRefreshButton = () => {
        return (
            <button
                onClick={() => onRefreshMap()}
                className="mt-4 w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
            >
                Refresh Map
            </button>
        );
    };
    return (
        <>
            <h1 className="text-2xl font-bold text-center mb-6">Game Page</h1>
            {gameRoom.gameStatus === 'waiting' ? (
                <>
                {renderWaitingRoom()}
                {renderRefreshButton()}
                </>
                
            ) : (
                <Game gameRoom={gameRoom}/>
            )}
            
        </>
    );
    }

export default GamePage;

