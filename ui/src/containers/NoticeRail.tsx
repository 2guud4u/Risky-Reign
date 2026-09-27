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

/** How long (ms) the your-turn toast stays visible before auto-hiding. */
const TOAST_DURATION_MS = 3000;
/** How long (ms) the fade-out takes. */
const FADE_OUT_MS = 300;

/** Neutral (waiting-on-someone-else) vs amber (you must act) notice chrome. */
const noticeClass = (mine: boolean): string =>
  `px-4 py-2 text-sm rounded-md border shadow-lg ${
    mine
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-gray-200 bg-gray-50 text-gray-600'
  }`;

/**
 * The single top-center notice column. Everything that used to pin itself to
 * `top-3 left-1/2` — the your-turn toast and each "waiting on X / do Y"
 * notice — now stacks here so the notices can never overlap. Order:
 * your-turn toast first, then the action notices.
 */
const NoticeRail: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastClosing, setToastClosing] = useState(false);

  const isMyTurn =
    gameRoom?.gameStatus === 'playing' &&
    gameRoom?.turnState.player === currentPlayer?.name;

  // Show the your-turn toast for TOAST_DURATION_MS each time it becomes your
  // turn, then fade it out.
  useEffect(() => {
    if (!isMyTurn) {
      setToastVisible(false);
      setToastClosing(false);
      return;
    }
    setToastVisible(true);
    setToastClosing(false);
    const hideTimer = setTimeout(() => {
      setToastClosing(true);
      setTimeout(() => setToastVisible(false), FADE_OUT_MS);
    }, TOAST_DURATION_MS);
    return () => clearTimeout(hideTimer);
  }, [isMyTurn]);

  if (!gameRoom || !currentPlayer) return null;

  // Build the list of action/waiting notices, highest-priority first.
  const notices: { key: string; mine: boolean; text: React.ReactNode }[] = [];
  const pendingDiscards = Object.keys(gameRoom.discards ?? {});
  if (pendingDiscards.length > 0 && gameRoom.discards && !(currentPlayer.name in gameRoom.discards)) {
    notices.push({
      key: 'discard',
      mine: false,
      text: `${pendingDiscards.join(', ')} must discard cards`,
    });
  }
  if (gameRoom.steal && gameRoom.steal.thief !== currentPlayer.name) {
    notices.push({
      key: 'steal',
      mine: false,
      text: `${gameRoom.steal.thief} is choosing a card to steal`,
    });
  }
  if (gameRoom.devCardChoice && gameRoom.devCardChoice.player !== currentPlayer.name) {
    notices.push({
      key: 'devcard',
      mine: false,
      text: `${gameRoom.devCardChoice.player} is choosing a card`,
    });
  }
  if (gameRoom.robberMove) {
    const { player, reason } = gameRoom.robberMove;
    const isMe = player === currentPlayer.name;
    notices.push({
      key: 'robber',
      mine: isMe,
      text: isMe
        ? reason === 'seven'
          ? pendingDiscards.length > 0
            ? 'You rolled a 7 — resolve the discard prompt, then drag the black robber to a hex to move it.'
            : 'You rolled a 7 — drag the black robber to a hex to move it.'
          : 'Knight: drag the black robber to a hex to place it and steal a card.'
        : `${player} must move the robber (${reason === 'seven' ? 'rolled a 7' : 'knight card'}).`,
    });
  }

  const phase = gameRoom.turnState.phase;
  const showToast = toastVisible && isMyTurn;
  if (!showToast && notices.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2">
      {showToast && (
        <div
          className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl shadow-2xl bg-gradient-to-r ${phaseGradient(
            phase
          )} text-white transition-opacity duration-300 ${
            toastClosing ? 'opacity-0' : 'opacity-100'
          }`}
          style={toastClosing ? undefined : { animation: 'slide-down 0.35s ease-out' }}
        >
          <span className="text-2xl drop-shadow">🎯</span>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold drop-shadow">It's your turn</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
              {phase} phase
            </span>
          </div>
        </div>
      )}
      {notices.map((n) => (
        <div key={n.key} className={noticeClass(n.mine)}>
          {n.text}
        </div>
      ))}
    </div>
  );
};

export default NoticeRail;
