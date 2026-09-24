import React from 'react';
import { LOBBY_HEX_SIZE, MIN_PLAYERS, DEFAULT_POINTS_TO_WIN } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import ColorPicker from '../components/ColorPicker';
import BoardView from '../containers/BoardView';
import Game from '../containers/Game';
import VictoryOverlay from '../containers/VictoryOverlay';

const GamePage: React.FC<{ error: string | null; onCustomizeBoard?: () => void }> = ({ error, onCustomizeBoard }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const {
    startGame: onStartGame,
    refreshMap: onRefreshMap,
    updatePlayerColor: onUpdatePlayerColor,
    updatePointsToWin: onUpdatePointsToWin,
  } = useSocket();

  if (!gameRoom || !currentPlayer) {
    return <p className="text-center text-gray-500">Loading game...</p>;
  }

  // Waiting room: players gather, pick their color, then the host starts the game.
  if (gameRoom.gameStatus === 'waiting') {
    const canStart = gameRoom.players.length >= MIN_PLAYERS;
    return (
      <div className="flex items-center justify-center min-h-screen w-full p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 w-full">
          <div />
          <div className="bg-white rounded-lg shadow p-4 max-w-[520px]">
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
          {onCustomizeBoard && (
            <button
              onClick={onCustomizeBoard}
              className="mt-2 w-full py-2.5 px-4 bg-emerald-600 text-white border-0 rounded-md cursor-pointer text-sm"
            >
              Customize Board
            </button>
          )}
          <div className="mt-4 flex justify-center">
            <BoardView hexSize={LOBBY_HEX_SIZE} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 max-w-[320px] justify-self-end">
          <h2 className="text-xl font-bold text-center mb-4">Game Settings</h2>
          <label className="block text-[13px] font-semibold mb-1.5">Points to Win</label>
          <input
            type="number"
            min={1}
            value={gameRoom.pointsToWin}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!Number.isNaN(value) && value >= 1) {
                onUpdatePointsToWin(gameRoom.id, value);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-[15px]"
          />
          <button
            onClick={() => onUpdatePointsToWin(gameRoom.id, DEFAULT_POINTS_TO_WIN)}
            className="mt-3 w-full py-2 px-4 border border-gray-300 bg-gray-100 rounded-md text-sm cursor-pointer"
          >
            Reset to Default
          </button>
        </div>
        </div>
      </div>
    );
  }

  // Game over: the first player to reach WIN_VP victory points wins.
  // Shown as an overlay on top of the board (the board stays visible behind).
  if (gameRoom.gameStatus === 'finished') {
    return (
      <>
        <Game />
        <VictoryOverlay />
      </>
    );
  }

  return <Game />;
};

export default GamePage;
