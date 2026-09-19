import React from 'react';
import { LOBBY_HEX_SIZE, WIN_VP, MIN_PLAYERS } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import ColorPicker from '../components/ColorPicker';
import BoardView from '../containers/BoardView';
import Game from '../containers/Game';

const GamePage: React.FC<{ error: string | null }> = ({ error }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const {
    startGame: onStartGame,
    resetGame: onResetGame,
    refreshMap: onRefreshMap,
    updatePlayerColor: onUpdatePlayerColor,
  } = useSocket();

  if (!gameRoom || !currentPlayer) {
    return <p className="text-center text-gray-500">Loading game...</p>;
  }

  // Waiting room: players gather, pick their color, then the host starts the game.
  if (gameRoom.gameStatus === 'waiting') {
    const canStart = gameRoom.players.length >= MIN_PLAYERS;
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
          {canStart && (
            <button
              onClick={() => onStartGame(gameRoom.id)}
              className="mt-4 w-full py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white bg-blue-500 cursor-pointer"
            >
              Start Game
            </button>
          )}
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

  // Game over: the first player to reach WIN_VP victory points wins.
  if (gameRoom.gameStatus === 'finished') {
    const standings = [...gameRoom.players].sort((a, b) => b.victoryPoints - a.victoryPoints);
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow p-8 max-w-[520px] w-full text-center">
          <h1 className="text-3xl font-bold mb-2">🏆 {gameRoom.winner} wins!</h1>
          <p className="text-gray-600 mb-6">First to {WIN_VP} victory points wins the game.</p>
          <div className="space-y-2 mb-6">
            {standings.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50"
              >
                <span className="font-semibold" style={{ color: p.color }}>
                  {p.name}
                </span>
                <span className="text-yellow-700 font-semibold">⭐ {p.victoryPoints} VP</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => onResetGame(gameRoom.id)}
            className="w-full py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white bg-blue-500 cursor-pointer"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return <Game />;
};

export default GamePage;
