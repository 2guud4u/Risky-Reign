import React from 'react';
import { Board, PublicPlayer, RoomBonuses } from 'common';
import Chip from '../../components/ui/Chip';
import GameIcon from '../../components/ui/GameIcon';

interface PlayersListProps {
  players: PublicPlayer[];
  board?: Board | null;
  bonuses?: RoomBonuses;
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
        const hasAdmiral = bonuses?.hasAdmiral?.[player.name] ?? false;
        const fleetSize = bonuses?.fleetSize?.[player.name] ?? 0;
        const hasWall = bonuses?.hasGreatWall?.[player.name] ?? false;
        const wallRun = bonuses?.wallRun?.[player.name] ?? 0;
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
                className="inline-block w-3 h-3 rounded-full border border-ink-faint/50 shrink-0"
                style={{ background: player.color || '#999' }}
                title={player.color}
              />
            }
            trailing={
              <>
                {hasRoad && (
                  <span className="text-sky font-semibold" title={`Longest road: ${roadLen} roads (+2 VP)`}>
                    <GameIcon name="road" size={12} className="inline" />{roadLen}
                  </span>
                )}
                {hasArmy && (
                  <span className="text-clay font-semibold" title={`Largest army: ${soldiers} soldiers (+2 VP)`}>
                    <GameIcon name="attack" size={12} />
                  </span>
                )}
                {hasWar && (
                  <span className="text-clay font-semibold" title={`Conqueror: ${battlesWon} battles won (+2 VP)`}>
                    <GameIcon name="crown" size={12} />
                  </span>
                )}
                {hasAdmiral && (
                  <span className="text-sky font-semibold" title={`The Admiral: ${fleetSize} ships (+1 VP, +1 sail step per ship)`}>
                    <GameIcon name="ship" size={12} className="inline" />{fleetSize}
                  </span>
                )}
                {hasWall && (
                  <span className="text-ink-soft font-semibold" title={`The Great Wall: ${wallRun} connected walls (+1 VP, walls break on 5+)`}>
                    <GameIcon name="wall" size={12} className="inline" />{wallRun}
                  </span>
                )}
                {battlesWon > 0 && (
                  <span className="text-clay font-semibold" title={`Battles won: ${battlesWon}`}>
                    <GameIcon name="trophy" size={12} className="inline" />{battlesWon}
                  </span>
                )}
                {(player.victoryPoints ?? 0) > 0 && (
                  <span className="text-gold-deep" title="Victory points">
                    <GameIcon name="star" size={12} className="inline" />{player.victoryPoints}
                  </span>
                )}
                <span className="text-ink-soft" title="Total resource cards">
                  <GameIcon name="cards" size={12} className="inline" />{totalResources}
                </span>
              </>
            }
          >
            <span className={player.eliminated ? 'line-through' : undefined} title={player.name}>
              {player.name}
            </span>
            {player.id === currentPlayerId && <span className="text-[11px] text-ink-faint"> (you)</span>}
            {!player.connected && (
              <span
                className="ml-1 text-[10px] font-semibold text-white bg-canvas-sunken0 rounded-full px-1.5"
                title="Disconnected — anyone with the room link can take this seat"
              >
                offline
              </span>
            )}
            {player.eliminated && (
              <span className="ml-1 text-[12px]" title="No settlements, cities, or soldiers left — spectating">
                <GameIcon name="skull" size={12} />
              </span>
            )}
          </Chip>
        );
      })}
    </div>
  );
};

export default PlayersList;
