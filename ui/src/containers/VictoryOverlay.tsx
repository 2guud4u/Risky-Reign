import React from 'react';
import { WIN_VP } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

/**
 * Victory overlay: shown on top of the board when the game ends. Displays the
 * winner, the final standings, and a "Play Again" button (which returns the
 * room to the lobby).
 */
const VictoryOverlay: React.FC = () => {
  const { gameRoom } = useGameRoom();
  const { resetGame } = useSocket();
  if (!gameRoom) return null;

  const standings = [...gameRoom.players].sort((a, b) => b.victoryPoints - a.victoryPoints);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-[520px] w-full text-center">
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
          onClick={() => resetGame(gameRoom.id)}
          className="w-full py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white bg-blue-500 cursor-pointer"
        >
          Play Again
        </button>
      </div>
    </div>
  );
};

export default VictoryOverlay;
