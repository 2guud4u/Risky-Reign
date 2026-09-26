import React, { useEffect, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';

/** Tailwind gradient classes for the your-turn toast, keyed to the current phase. */
const phaseGradient = (phase: string): string => {
  switch (phase) {
    case 'SetUp':
      return 'from-blue-500 to-blue-700';
    case 'Dice':
      return 'from-amber-400 to-amber-600';
    case 'Build':
      return 'from-green-500 to-green-700';
    case 'Action':
      return 'from-rose-500 to-rose-700';
    default:
      return 'from-gray-500 to-gray-700';
  }
};

/** How long (ms) the your-turn pop-up stays visible before auto-hiding. */
const TOAST_DURATION_MS = 3000;
/** How long (ms) the fade-out takes. */
const FADE_OUT_MS = 300;

/**
 * A small pop-up shown when it's the current player's turn, announcing the turn
 * and the phase. Slides down from the top-center, stays for 3 seconds, then
 * fades out. Re-appears each time it becomes your turn again.
 */
const YourTurnToast: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const isMyTurn =
    gameRoom?.gameStatus === 'playing' &&
    gameRoom?.turnState.player === currentPlayer?.name;

  // Show the toast for TOAST_DURATION_MS each time it becomes your turn, then
  // fade it out.
  useEffect(() => {
    if (!isMyTurn) {
      setVisible(false);
      setClosing(false);
      return;
    }
    setVisible(true);
    setClosing(false);
    const hideTimer = setTimeout(() => {
      setClosing(true);
      setTimeout(() => setVisible(false), FADE_OUT_MS);
    }, TOAST_DURATION_MS);
    return () => clearTimeout(hideTimer);
  }, [isMyTurn]);

  if (!gameRoom || !currentPlayer || !visible) return null;

  const phase = gameRoom.turnState.phase;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90]">
      <div
        className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl shadow-2xl bg-gradient-to-r ${phaseGradient(
          phase
        )} text-white transition-opacity duration-300 ${
          closing ? 'opacity-0' : 'opacity-100'
        }`}
        style={closing ? undefined : { animation: 'slide-down 0.35s ease-out' }}
      >
        <span className="text-2xl drop-shadow">🎯</span>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold drop-shadow">It's your turn</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
            {phase} phase
          </span>
        </div>
      </div>
    </div>
  );
};

export default YourTurnToast;
