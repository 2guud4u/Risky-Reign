import React from 'react';
import { Board, Player } from 'common';

interface PlayersListProps {
  players: Player[];
  board?: Board | null;
  bonuses?: {
    longestRoad: Record<string, number>;
    largestArmy: Record<string, number>;
    hasLongestRoad: Record<string, boolean>;
    hasLargestArmy: Record<string, boolean>;
  };
  currentPlayerId?: string;
}

const PlayersList: React.FC<PlayersListProps> = ({ players, board, bonuses, currentPlayerId }) => {
  const soldiersFor = (name: string) =>
    board ? Object.values(board.soldiers).filter((s) => s.owner === name).length : 0;

  return (
    <div className="flex flex-col gap-2">
      {players.map((player) => {
        const soldiers = soldiersFor(player.name);
        const hasRoad = bonuses?.hasLongestRoad?.[player.name] ?? false;
        const hasArmy = bonuses?.hasLargestArmy?.[player.name] ?? false;
        const roadLen = bonuses?.longestRoad?.[player.name] ?? 0;
        return (
          <div
            key={player.id}
            className={`border border-gray-300 rounded-md p-2 ${
              player.id === currentPlayerId ? 'bg-blue-50' : 'bg-white'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-block w-3 h-3 rounded-full border border-gray-300"
                style={{ background: player.color || '#999' }}
                title={player.color}
              />
              <strong>{player.name}</strong>
              {player.id === currentPlayerId && <span>(you)</span>}
              {(player.victoryPoints ?? 0) > 0 && (
                <span className="text-[12px] text-yellow-700" title="Victory points">
                  ⭐ {player.victoryPoints}
                </span>
              )}
              {hasRoad && (
                <span
                  className="text-[12px] text-blue-700 font-semibold"
                  title={`Longest road: ${roadLen} roads (+2 VP)`}
                >
                  🛤️ Longest road ({roadLen})
                </span>
              )}
              {hasArmy && (
                <span
                  className="text-[12px] text-red-700 font-semibold"
                  title={`Largest army: ${soldiers} soldiers (+2 VP)`}
                >
                  ⚔️ Largest army ({soldiers})
                </span>
              )}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              <span className="mr-2.5" title="Soldiers on the board">
                ⚔️ {soldiers}
              </span>
              {Object.entries(player.resources).map(([resource, value]) => (
                <span key={resource} className="mr-2.5">
                  {resource}: {value}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlayersList;
