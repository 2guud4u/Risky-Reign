import React from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import EndTurnButton from './SideBar/EndTurnButton';
import { SIDEBAR_W } from '../constants';

/** Tailwind classes for the turn overlay, keyed to the current phase. */
const phaseColor = (phase: string): string => {
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
 * Turn overlay: phase + control on the board's bottom edge, colored by phase.
 * Shows the current phase, an undo button (when available), and the end-turn
 * button.
 */
const TurnOverlay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { undoBuild } = useSocket();
  if (!gameRoom || !currentPlayer) return null;

  // Undo is available only while it is this player's turn, in the Build or
  // Action phase, and there is at least one action this phase to undo.
  const canUndo =
    gameRoom.turnState.player === currentPlayer.name &&
    (gameRoom.turnState.phase === 'Build' || gameRoom.turnState.phase === 'Action') &&
    (gameRoom.turnState.undoLog?.length ?? 0) > 0;

  return (
    <div
      className={`fixed bottom-3 z-40 flex flex-col gap-1.5 px-4 py-2.5 rounded-xl shadow-lg text-white min-w-[240px] ${phaseColor(gameRoom.turnState.phase)}`}
      style={{ right: SIDEBAR_W + 12 }}
    >
      <div className="flex items-center gap-2.5">
        <span className="px-2 py-0.5 rounded-md bg-white/20 text-[11px] font-bold uppercase tracking-wide">
          {gameRoom.turnState.phase}
        </span>
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
          <EndTurnButton variant="snackbar" />
        </div>
      </div>
    </div>
  );
};

export default TurnOverlay;
