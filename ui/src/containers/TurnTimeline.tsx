import React from 'react';
import { upcomingTurns } from 'common';
import { useGameState, usePlayers } from '../contexts/GameContext';
import { phaseColor } from './TurnOverlay';
import Button from '../components/ui/Button';
import { X } from 'lucide-react';

/** How many turns ahead the timeline forecasts. */
const TIMELINE_LOOKAHEAD = 25;

/**
 * Turn timeline dropdown, hanging just under the turn status bar (its parent
 * is `relative`): a simple line diagram of the current turn plus the next
 * TIMELINE_LOOKAHEAD — one node per turn (player color), labelled with the
 * player and the phase. Forecast with the same `nextTurnPosition` the server
 * advances with.
 */
const TurnTimeline: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { gameRoom, currentPlayer } = useGameState();
  const { colorOf } = usePlayers();
  if (!gameRoom) return null;
  const knockedOut = gameRoom.players.filter((p) => p.eliminated).map((p) => p.name);
  const steps = [gameRoom.turnState, ...upcomingTurns(gameRoom.turnState, TIMELINE_LOOKAHEAD, knockedOut, gameRoom.turnMode)];
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 max-w-[calc(100vw-2rem)] rounded-xl bg-canvas-raised shadow-pop border border-ink-faint/40 px-4 pt-2 pb-3 text-ink">
      <div className="flex items-center mb-1">
        <span className="text-[12px] font-semibold text-ink-faint">Turn order</span>
        <Button
          variant="unstyled"
          onClick={onClose}
          className="ml-auto w-8 h-8 md:w-6 md:h-6 rounded text-ink-faint hover:text-ink-soft"
          aria-label="Close turn timeline"
        >
          <X size={14} />
        </Button>
      </div>
      {/* pt-2: overflow-x-auto clips vertically too — without headroom the
          current node's ring is cut off at the top.
          w-[400px] shows ~5 nodes (80px each); the other 20 scroll. */}
      <ol className="relative flex w-[400px] max-w-[calc(100vw-4rem)] m-0 p-0 pt-2 -mt-2 list-none overflow-x-auto overscroll-x-contain">
        {steps.map((pos, i) => {
          const now = i === 0;
          const name = pos.player === currentPlayer?.name ? 'You' : pos.player;
          return (
            <li key={i} className="relative flex flex-col items-center w-20 shrink-0">
              {/* The line: joins this node to the next one. */}
              {i < steps.length - 1 && (
                <span className="absolute top-[9px] left-1/2 w-full h-0.5 bg-ink-faint/50" aria-hidden="true" />
              )}
              <span
                className={`relative z-10 rounded-full border-2 border-white shadow ${
                  now ? 'w-5 h-5 ring-2 ring-ink' : 'w-4 h-4 mt-0.5'
                }`}
                style={{ background: colorOf(pos.player) ?? '#9b9183' }}
                aria-hidden="true"
              />
              <span
                className={`mt-1 max-w-full truncate text-[12px] ${now ? 'font-bold text-ink' : 'text-ink-soft'}`}
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
