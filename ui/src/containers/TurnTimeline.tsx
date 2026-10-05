import React from 'react';
import { upcomingTurns } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { playerColorMap } from '../utils/soldierPlacement';
import { phaseColor } from './TurnOverlay';

/** How many turns ahead the timeline forecasts. */
const TIMELINE_LOOKAHEAD = 5;

/**
 * Turn timeline dropdown, hanging just under the turn status bar (its parent
 * is `relative`): a simple line diagram of the current turn plus the next
 * TIMELINE_LOOKAHEAD — one node per turn (player color), labelled with the
 * player and the phase. Forecast with the same `nextTurnPosition` the server
 * advances with.
 */
const TurnTimeline: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  if (!gameRoom) return null;
  const colors = playerColorMap(gameRoom);
  const knockedOut = gameRoom.players.filter((p) => p.eliminated).map((p) => p.name);
  const steps = [gameRoom.turnState, ...upcomingTurns(gameRoom.turnState, TIMELINE_LOOKAHEAD, knockedOut)];
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 max-w-[calc(100vw-2rem)] rounded-xl bg-white/95 shadow-2xl border border-gray-200 px-4 pt-2 pb-3 text-gray-800">
      <div className="flex items-center mb-1">
        <span className="text-[12px] font-semibold text-gray-500">Turn order</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-1 text-gray-400 hover:text-gray-700 cursor-pointer"
          aria-label="Close turn timeline"
        >
          ✕
        </button>
      </div>
      <ol className="relative flex m-0 p-0 list-none overflow-x-auto">
        {steps.map((pos, i) => {
          const now = i === 0;
          const name = pos.player === currentPlayer?.name ? 'You' : pos.player;
          return (
            <li key={i} className="relative flex flex-col items-center w-20 shrink-0">
              {/* The line: joins this node to the next one. */}
              {i < steps.length - 1 && (
                <span className="absolute top-[9px] left-1/2 w-full h-0.5 bg-gray-300" aria-hidden="true" />
              )}
              <span
                className={`relative z-10 rounded-full border-2 border-white shadow ${
                  now ? 'w-5 h-5 ring-2 ring-gray-800' : 'w-4 h-4 mt-0.5'
                }`}
                style={{ background: colors[pos.player] ?? '#9ca3af' }}
                aria-hidden="true"
              />
              <span
                className={`mt-1 max-w-full truncate text-[12px] ${now ? 'font-bold text-gray-900' : 'text-gray-700'}`}
              >
                {name}
              </span>
              <span
                className={`mt-0.5 px-1.5 rounded text-[10px] font-bold uppercase tracking-wide text-white ${phaseColor(pos.phase)}`}
              >
                {pos.phase}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default TurnTimeline;
