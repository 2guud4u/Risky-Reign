import React from 'react';
import { createPortal } from 'react-dom';
import { TurnPosition, turnActions, upcomingTurns } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { playerColorMap } from '../utils/soldierPlacement';
import { phaseColor } from './TurnOverlay';

/** How many turns ahead the timeline forecasts. */
const TIMELINE_LOOKAHEAD = 4;

/** One step of the timeline: who, which phase, and what they can do. */
const TurnCard: React.FC<{ pos: TurnPosition; now: boolean; you: boolean; color: string }> = ({
  pos,
  now,
  you,
  color,
}) => (
  <div
    className={`w-44 shrink-0 rounded-lg border bg-white p-2 flex flex-col gap-1.5 ${
      now ? 'border-gray-800 ring-2 ring-gray-800/20' : 'border-gray-200'
    }`}
  >
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[13px] font-bold truncate">{you ? 'You' : pos.player}</span>
      <span className="ml-auto text-[10px] font-semibold text-gray-400 uppercase">{now ? 'Now' : ''}</span>
    </div>
    <span
      className={`self-start px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white ${phaseColor(pos.phase)}`}
    >
      {pos.phase}
    </span>
    <div className="flex flex-wrap gap-1">
      {turnActions(pos).map((a) => (
        <span key={a} className="px-1.5 py-0.5 rounded bg-gray-100 text-[11px] text-gray-700">
          {a}
        </span>
      ))}
    </div>
  </div>
);

/**
 * Bottom-center turn timeline: the current turn plus the next
 * TIMELINE_LOOKAHEAD, forecast with the same `nextTurnPosition` the server
 * advances with. Portaled to <body> so it is positioned against the viewport
 * (its opener lives in the transformed top-center rail).
 */
const TurnTimeline: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  if (!gameRoom || !currentPlayer) return null;
  const colors = playerColorMap(gameRoom);
  const knockedOut = gameRoom.players.filter((p) => p.eliminated).map((p) => p.name);
  const steps = [gameRoom.turnState, ...upcomingTurns(gameRoom.turnState, TIMELINE_LOOKAHEAD, knockedOut)];
  return createPortal(
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] max-w-[calc(100vw-2rem)] rounded-xl bg-white/95 shadow-2xl border border-gray-200 p-3">
      <div className="flex items-center mb-2">
        <span className="text-[13px] font-semibold text-gray-700">Turn order</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-2 text-gray-400 hover:text-gray-700 cursor-pointer"
          aria-label="Close turn timeline"
        >
          ✕
        </button>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto">
        {steps.map((pos, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="self-center text-gray-300 text-lg">›</span>}
            <TurnCard
              pos={pos}
              now={i === 0}
              you={pos.player === currentPlayer.name}
              color={colors[pos.player] ?? '#9ca3af'}
            />
          </React.Fragment>
        ))}
      </div>
    </div>,
    document.body
  );
};

export default TurnTimeline;
