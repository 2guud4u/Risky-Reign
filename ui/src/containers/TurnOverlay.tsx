import React, { useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import EndTurnButton from './game/EndTurnButton';
import TurnTimeline from './TurnTimeline';

/** Tailwind classes for the turn overlay, keyed to the current phase. */
export const phaseColor = (phase: string): string => {
  switch (phase) {
    case 'SetUp':
      return 'bg-blue-600';
    case 'Dice':
      return 'bg-amber-500';
    case 'Build':
      return 'bg-green-600';
    case 'Action':
      return 'bg-rose-600';
    default:
      return 'bg-gray-600';
  }
};

/**
 * Turn status bar: phase + control, colored by phase. Shows the current phase
 * (click it to open the turn timeline), an undo button (when available), and
 * the end-turn button. Positioned by NoticeRail (top center, above the notices).
 */
const TurnOverlay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { undoBuild } = useSocket();
  const [timelineOpen, setTimelineOpen] = useState(false);
  if (!gameRoom) return null;

  // Undo is available only while it is this player's turn, in the Build or
  // Action phase, and there is at least one action this phase to undo.
  // (A robber fight is never logged, so it can't be undone — it happens
  // after the roll.)
  const canUndo =
    !!currentPlayer &&
    gameRoom.turnState.player === currentPlayer.name &&
    (gameRoom.turnState.phase === 'Build' || gameRoom.turnState.phase === 'Action') &&
    (gameRoom.turnState.undoLog?.length ?? 0) > 0;

  return (
    <div
      className={`relative z-10 shrink-0 flex flex-col gap-1.5 px-4 py-2.5 rounded-xl shadow-lg text-white min-w-[240px] ${phaseColor(gameRoom.turnState.phase)}`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setTimelineOpen((o) => !o)}
          className="px-2 py-0.5 rounded-md bg-white/20 text-[11px] font-bold uppercase tracking-wide cursor-pointer hover:bg-white/35"
          title="Show upcoming turns"
          aria-expanded={timelineOpen}
        >
          {gameRoom.turnState.phase} ▾
        </button>
        <div className="ml-auto flex items-center gap-2">
          {canUndo && (
            <button
              type="button"
              onClick={() => undoBuild(gameRoom.id)}
              className="px-2.5 py-1.5 text-[13px] font-semibold rounded-md bg-white/25 cursor-pointer hover:bg-white/40"
              title="Undo last action"
              aria-label="Undo last action"
            >
              {'↶'} Undo
            </button>
          )}
          {currentPlayer ? (
            <EndTurnButton variant="snackbar" />
          ) : (
            // Spectators: whose turn it is, no controls.
            <span className="text-[13px] font-semibold">{gameRoom.turnState.player}'s turn</span>
          )}
        </div>
      </div>
      {timelineOpen && <TurnTimeline onClose={() => setTimelineOpen(false)} />}
    </div>
  );
};

export default TurnOverlay;
