import React from 'react';
import { Player } from 'common/v2';

interface PlayersListProps {
  players: Player[];
  currentPlayerId?: string;
}

const PlayersList: React.FC<PlayersListProps> = ({ players, currentPlayerId }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {players.map((player) => (
        <div
          key={player.id}
          style={{
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: 8,
            background: player.id === currentPlayerId ? '#eff6ff' : '#fff',
          }}
        >
          <strong>{player.name}</strong>
          {player.id === currentPlayerId && <span> (you)</span>}
          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
            {Object.entries(player.resources).map(([resource, value]) => (
              <span key={resource} style={{ marginRight: 10 }}>
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
