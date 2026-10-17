import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useGameState } from '../../contexts/GameContext';
import PlayersList from '../../containers/game/PlayersList';
import MapIconButton from '../ui/MapIconButton';
import { User } from 'lucide-react';

/**
 * 👤 button on the map (under 💬 chat, under the 🔄 trade and ℹ️ recipes
 * buttons). Clicking it toggles a column of player chips down the
 * left side of the map; clicking it again hides them.
 */
const PlayersButton: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  if (!gameRoom || !currentPlayer) return null;

  return (
    <>
      <MapIconButton
        icon={<User size={22} />}
        active={open}
        onClick={() => setOpen((o) => !o)}
        onMouseDown={(e) => e.stopPropagation()}
        title={open ? 'Hide players' : 'Players'}
        aria-label={open ? 'Hide players' : 'Show players'}
        aria-expanded={open}
        className="top-[176px] left-[max(0.5rem,env(safe-area-inset-left))]"
      />

      <AnimatePresence>
      {open && (
        <motion.div
          role="region"
          aria-label="Players"
          // Below the four corner buttons; keep clicks inside from panning the map.
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-[236px] left-[max(0.5rem,env(safe-area-inset-left))] z-20 w-[280px] max-h-[calc(100%-250px)] overflow-y-auto origin-top-left"
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
