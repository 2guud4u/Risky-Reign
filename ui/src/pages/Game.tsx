import React from 'react';
import { LOBBY_HEX_SIZE } from 'common';
import Game from '../containers/Game';
import BoardView from '../containers/BoardView';
import ColorPicker from '../components/ColorPicker';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

const GamePage: React.FC<{ error: string | null }> = ({ error }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { startGame: onStartGame, refreshMap: onRefreshMap, updatePlayerColor: onUpdatePlayerColor } =
    useSocket();

  if (!gameRoom || !currentPlayer) {
    return <p className="text-center text-gray-500">Loading game...</p>;
  }

  // Waiting room: players gather, pick their color, then the host starts the game.
  if (gameRoom.gameStatus === 'waiting') {
    const canStart = gameRoom.players.length >= 2;
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow p-4 max-w-[520px] w-full">
          <h1 className="text-2xl font-bold text-center mb-4">Waiting for Players</h1>
          <p className="text-center text-gray-600">Current Room ID: {gameRoom.id}</p>
          <p className="text-center text-gray-600">
            Players: {gameRoom.players.map((p) => p.name).join(', ')}
          </p>

          <div className="mt-4">
            <label className="block text-[13px] font-semibold mb-1.5">Your Color</label>
            <ColorPicker
              value={currentPlayer.color}
              onChange={(color) => onUpdatePlayerColor(gameRoom.id, color)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Your settlements and roads on the board will use this color.
            </p>
          </div>

          {error && <p className="text-red-600 text-center mt-2">{error}</p>}
          <button
            onClick={() => onStartGame(gameRoom.id)}
            disabled={!canStart}
            className={`mt-4 w-full py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white ${
              canStart ? 'bg-blue-500 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Start Game
          </button>
          <button
            onClick={() => onRefreshMap(gameRoom.id)}
            className="mt-2 w-full py-2.5 px-4 bg-green-500 text-white border-0 rounded-md cursor-pointer text-sm"
          >
            Refresh Map
          </button>
          <div className="mt-4 flex justify-center">
            <BoardView hexSize={LOBBY_HEX_SIZE} />
          </div>
        </div>
      </div>
    );
  }

  return <Game />;
};

export default GamePage;
