import React from 'react';
import { Board, PublicPlayer } from 'common';

interface PlayersListProps {
  players: PublicPlayer[];
  board?: Board | null;
  bonuses?: {
    longestRoad: Record<string, number>;
    largestArmy: Record<string, number>;
    hasLongestRoad: Record<string, boolean>;
    hasLargestArmy: Record<string, boolean>;
    battlesWon: Record<string, number>;
    hasWarmonger: Record<string, boolean>;
  };
  currentPlayerId?: string;
}

/** One see-through card per player, shown over the map from the 👤 button. */
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
        const hasWar = bonuses?.hasWarmonger?.[player.name] ?? false;
        const battlesWon = bonuses?.battlesWon?.[player.name] ?? 0;
        // Opponents' hands are masked server-side; the public total is all we show.
        const totalResources = player.resourceCount;
        return (
          <div
            key={player.id}
            className={`border border-white/50 rounded-md p-2 backdrop-blur-sm shadow ${
              player.id === currentPlayerId ? 'bg-blue-50/70' : 'bg-white/70'
            } ${player.eliminated ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-block w-3 h-3 rounded-full border border-gray-300"
                style={{ background: player.color || '#999' }}
                title={player.color}
              />
              <strong className={player.eliminated ? 'line-through' : undefined}>{player.name}</strong>
              {player.id === currentPlayerId && <span>(you)</span>}
              {!player.connected && (
                <span
                  className="text-[11px] font-semibold text-white bg-gray-500 rounded px-1.5"
                  title="Disconnected — anyone with the room link can take this seat"
                >
                  offline
                </span>
              )}
              {player.eliminated && (
                <span
                  className="text-[12px] text-gray-600 font-semibold"
                  title="No settlements, cities, or soldiers left — spectating"
                >
                  💀 Knocked out
                </span>
              )}
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
              {hasWar && (
                <span
                  className="text-[12px] text-orange-700 font-semibold"
                  title={`Warmonger: ${battlesWon} battles won (+2 VP)`}
                >
                  🔥 Warmonger ({battlesWon})
                </span>
              )}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              <span className="mr-2.5" title="Soldiers on the board">
                ⚔️ {soldiers}
              </span>
              <span className="mr-2.5" title="Battles won">
                🏆 {battlesWon}
              </span>
              {/* Opponents' hands are masked server-side, so the public total
                  is all we can show. My own breakdown already sits in the
                  resource panel — don't repeat it here. */}
              <span className="mr-2.5" title="Total resource cards">
                🃏 {player.id === currentPlayerId ? Object.values(player.resources).reduce((a, b) => a + b, 0) : totalResources}
              </span>
              <span className="mr-2.5" title="Development cards">
                🎴 {player.devCardCount}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlayersList;
