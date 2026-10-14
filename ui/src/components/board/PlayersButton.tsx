import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useGameRoom } from '../../contexts/GameContext';
import PlayersList from '../../containers/game/PlayersList';

/**
 * 👤 button on the map (under 💬 chat, under the 🔄 trade and ℹ️ recipes
 * buttons). Clicking it toggles a column of player chips down the
 * left side of the map; clicking it again hides them.
 */
const PlayersButton: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  if (!gameRoom || !currentPlayer) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseDown={(e) => e.stopPropagation()}
        title={open ? 'Hide players' : 'Players'}
        aria-label={open ? 'Hide players' : 'Show players'}
        aria-expanded={open}
        className={`absolute top-[176px] left-2 z-20 flex items-center justify-center w-12 h-12 rounded-full border-2 shadow-lg text-2xl leading-none cursor-pointer hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 transition-transform ${
          open ? 'bg-blue-100 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-gray-300 hover:border-blue-500'
        }`}
      >
        <span aria-hidden="true">👤</span>
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          role="region"
          aria-label="Players"
          // Below the four corner buttons; keep clicks inside from panning the map.
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-[236px] left-2 z-20 w-[280px] max-h-[calc(100%-250px)] overflow-y-auto origin-top-left"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
          transition={reduce ? { duration: 0.1 } : { type: 'spring', stiffness: 480, damping: 34 }}
        >
          <PlayersList
            players={gameRoom.players}
            board={gameRoom.board}
            bonuses={gameRoom.bonuses}
            currentPlayerId={currentPlayer.id}
          />
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
};

export default PlayersButton;
