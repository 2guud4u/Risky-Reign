import React from 'react';
import { Player } from 'common';

interface PlayersListProps {
  players: Player[];
  currentPlayerId?: string;
}

const PlayersList: React.FC<PlayersListProps> = ({ players, currentPlayerId }) => {
  return (
    <div className="flex flex-col gap-2">
      {players.map((player) => (
        <div
          key={player.id}
          className={`border border-gray-300 rounded-md p-2 ${
            player.id === currentPlayerId ? 'bg-blue-50' : 'bg-white'
          }`}
        >
          <strong>{player.name}</strong>
          {player.id === currentPlayerId && <span> (you)</span>}
          <div className="text-xs text-gray-600 mt-1">
            {Object.entries(player.resources).map(([resource, value]) => (
              <span key={resource} className="mr-2.5">
                {resource}: {value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlayersList;
