import React from 'react';
import { Board, PublicPlayer } from 'common';
import Chip from '../../components/ui/Chip';

interface PlayersListProps {
  players: PublicPlayer[];
  board?: Board | null;
  bonuses?: {
    longestRoad: Record<string, number>;
    largestArmy: Record<string, number>;
    hasLongestRoad: Record<string, boolean>;
    hasLargestArmy: Record<string, boolean>;
    battlesWon: Record<string, number>;
    hasConqueror: Record<string, boolean>;
  };
  currentPlayerId?: string;
}

/** One compact chip per player, shown over the map from the 👤 button. */
const PlayersList: React.FC<PlayersListProps> = ({ players, board, bonuses, currentPlayerId }) => {
  const soldiersFor = (name: string) =>
    board ? Object.values(board.soldiers).filter((s) => s.owner === name).length : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {players.map((player) => {
        const soldiers = soldiersFor(player.name);
        const hasRoad = bonuses?.hasLongestRoad?.[player.name] ?? false;
        const hasArmy = bonuses?.hasLargestArmy?.[player.name] ?? false;
        const roadLen = bonuses?.longestRoad?.[player.name] ?? 0;
        const hasWar = bonuses?.hasConqueror?.[player.name] ?? false;
        const battlesWon = bonuses?.battlesWon?.[player.name] ?? 0;
        // Opponents' hands are masked server-side; the public total is all we show.
        const totalResources =
          player.id === currentPlayerId
            ? Object.values(player.resources).reduce((a, b) => a + b, 0)
            : player.resourceCount;
        return (
          <Chip
            key={player.id}
            tone={player.id === currentPlayerId ? 'accent' : player.eliminated ? 'muted' : 'default'}
            icon={
              <span
                className="inline-block w-3 h-3 rounded-full border border-gray-300 shrink-0"
                style={{ background: player.color || '#999' }}
                title={player.color}
              />
            }
            trailing={
              <>
                {hasRoad && (
                  <span className="text-blue-700 font-semibold" title={`Longest road: ${roadLen} roads (+2 VP)`}>
                    🛤️{roadLen}
                  </span>
                )}
                {hasArmy && (
                  <span className="text-red-700 font-semibold" title={`Largest army: ${soldiers} soldiers (+2 VP)`}>
                    ⚔️
                  </span>
                )}
                {hasWar && (
                  <span className="text-orange-700 font-semibold" title={`Conqueror: ${battlesWon} battles won (+2 VP)`}>
                    👑
                  </span>
                )}
                {battlesWon > 0 && (
                  <span className="text-amber-700 font-semibold" title={`Battles won: ${battlesWon}`}>
                    🏆{battlesWon}
                  </span>
                )}
                {(player.victoryPoints ?? 0) > 0 && (
                  <span className="text-yellow-700" title="Victory points">
                    ⭐{player.victoryPoints}
                  </span>
                )}
                <span className="text-gray-600" title="Total resource cards">
                  🃏{totalResources}
                </span>
              </>
            }
          >
            <span className={player.eliminated ? 'line-through' : undefined} title={player.name}>
              {player.name}
            </span>
            {player.id === currentPlayerId && <span className="text-[11px] text-gray-500"> (you)</span>}
            {!player.connected && (
              <span
                className="ml-1 text-[10px] font-semibold text-white bg-gray-500 rounded-full px-1.5"
                title="Disconnected — anyone with the room link can take this seat"
              >
                offline
              </span>
            )}
            {player.eliminated && (
              <span className="ml-1 text-[12px]" title="No settlements, cities, or soldiers left — spectating">
                💀
              </span>
            )}
          </Chip>
        );
      })}
    </div>
  );
};

export default PlayersList;
