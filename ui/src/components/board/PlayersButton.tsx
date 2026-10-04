import React, { useState } from 'react';
import { useGameRoom } from '../../contexts/GameContext';
import PlayersList from '../../containers/game/PlayersList';

/**
 * 👤 button on the map (under the 🤝 trade and ℹ️ recipes buttons). Clicking
 * it toggles a column of see-through player cards down the left side of the
 * map; clicking it again hides them.
 */
const PlayersButton: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const [open, setOpen] = useState(false);
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
        className={`absolute top-[120px] left-2 z-20 flex items-center justify-center w-12 h-12 rounded-full border-2 shadow-lg text-2xl leading-none cursor-pointer hover:scale-110 transition-transform ${
          open ? 'bg-blue-100 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-gray-300 hover:border-blue-500'
        }`}
      >
        <span aria-hidden="true">👤</span>
      </button>

      {open && (
        <div
          role="region"
          aria-label="Players"
          // Below the three corner buttons; keep clicks inside from panning the map.
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-[180px] left-2 z-20 w-[280px] max-h-[calc(100%-316px)] overflow-y-auto"
        >
          <PlayersList
            players={gameRoom.players}
            board={gameRoom.board}
            bonuses={gameRoom.bonuses}
            currentPlayerId={currentPlayer.id}
          />
        </div>
      )}
    </>
  );
};

export default PlayersButton;
