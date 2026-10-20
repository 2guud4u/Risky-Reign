import React, { useState } from 'react';
import { useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import EndTurnButton from './game/EndTurnButton';
import Button from '../components/ui/Button';
import TurnTimeline from './TurnTimeline';
import { Undo2 } from 'lucide-react';

/** Tailwind classes for the turn overlay, keyed to the current phase. */
export const phaseColor = (phase: string): string => {
  switch (phase) {
    case 'SetUp':
      return 'bg-phase-setup';
    case 'Dice':
      return 'bg-phase-dice';
    case 'Build':
      return 'bg-phase-build';
    case 'Action':
      return 'bg-phase-action';
    default:
      return 'bg-ink-soft';
  }
};

/**
 * Turn status bar: phase + control, colored by phase. Shows the current phase
 * (click it to open the turn timeline), an undo button (when available), and
 * the end-turn button. Positioned by NoticeRail (top center, above the notices).
 */
const TurnOverlay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const { undoBuild } = useSocket();
  const [timelineOpen, setTimelineOpen] = useState(false);
  if (!gameRoom) return null;

  // Undo is available only while it is this player's turn, in the Build or
  // Action phase, and there is at least one action this phase to undo.
  // (A robber fight is never logged, so it can't be undone — it happens
  // after the roll.)
  const myTurn = !!currentPlayer && gameRoom.turnState.player === currentPlayer.name;
  const canUndo =
    myTurn &&
    (gameRoom.turnState.phase === 'Build' || gameRoom.turnState.phase === 'Action') &&
    (gameRoom.turnState.undoLog?.length ?? 0) > 0;

  return (
    <div
      // On my turn, a gradient sweeps around the border (.turn-glow).
      className={`relative z-10 shrink-0 flex flex-col gap-1.5 px-4 py-2.5 rounded-xl shadow-lg text-white min-w-[240px] ${phaseColor(gameRoom.turnState.phase)} ${myTurn ? 'turn-glow' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <Button
          variant="unstyled"
          onClick={() => setTimelineOpen((o) => !o)}
          className="px-2 py-2 md:py-0.5 rounded-md bg-canvas-raised/20 text-[11px] font-bold uppercase tracking-wide hover:bg-canvas-raised/35"
          title="Show upcoming turns"
          aria-expanded={timelineOpen}
        >
          {gameRoom.turnState.phase} ▾
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {canUndo && (
            <Button
              variant="unstyled"
              onClick={() => undoBuild()}
              className="flex items-center gap-1 px-2.5 py-2 md:py-1.5 text-[13px] font-semibold rounded-md bg-canvas-raised/25 hover:bg-canvas-raised/40"
              title="Undo last action"
              aria-label="Undo last action"
            >
              <Undo2 size={14} /> Undo
            </Button>
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
