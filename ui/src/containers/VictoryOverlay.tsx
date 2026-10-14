import React, { useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Victory overlay: shown on top of the board when the game ends. Displays the
 * winner, the final standings, and a "Play Again" button (which returns the
 * room to the lobby). "View map" collapses it to a small bottom banner so
 * players can still pan/zoom and look around the final board.
 */
const VictoryOverlay: React.FC = () => {
  const { gameRoom } = useGameRoom();
  const { resetGame } = useSocket();
  const [viewingMap, setViewingMap] = useState(false);
  const reduce = useReducedMotion();
  if (!gameRoom) return null;

  if (viewingMap) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl bg-white border border-gray-200">
        <span className="text-[15px] font-bold">🏆 {gameRoom.winner} wins!</span>
        <button
          type="button"
          onClick={() => setViewingMap(false)}
          className="px-3 py-1.5 rounded-md text-[13px] font-semibold border border-gray-300 bg-gray-100 cursor-pointer hover:bg-gray-200"
        >
          Show results
        </button>
        <button
          type="button"
          onClick={() => resetGame(gameRoom.id)}
          className="px-3 py-1.5 rounded-md text-[13px] font-semibold text-white bg-blue-500 cursor-pointer"
        >
          Play Again
        </button>
      </div>
    );
  }

  const standings = [...gameRoom.players].sort((a, b) => b.victoryPoints - a.victoryPoints);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <motion.div
        className="bg-white rounded-xl shadow-2xl p-8 max-w-[520px] w-full text-center"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 360, damping: 26 }}
      >
        <h1 className="text-3xl font-bold mb-2">🏆 {gameRoom.winner} wins!</h1>
        <p className="text-gray-600 mb-6">
          First to {gameRoom.pointsToWin} victory points — or the last player standing — wins the game.
        </p>
        <div className="space-y-2 mb-6">
          {standings.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50"
            >
              <span className="font-semibold" style={{ color: p.color }}>
                {p.name}
              </span>
              <span className="text-yellow-700 font-semibold">
                {p.eliminated && <span className="text-gray-500 mr-2">💀 Knocked out</span>}⭐ {p.victoryPoints} VP
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewingMap(true)}
            className="flex-1 py-2.5 px-4 rounded-md text-[15px] font-semibold border border-gray-300 bg-gray-100 cursor-pointer hover:bg-gray-200"
          >
            View map
          </button>
          <button
            type="button"
            onClick={() => resetGame(gameRoom.id)}
            className="flex-1 py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white bg-blue-500 cursor-pointer transition-all active:scale-95 motion-reduce:active:scale-100"
          >
            Play Again
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VictoryOverlay;
