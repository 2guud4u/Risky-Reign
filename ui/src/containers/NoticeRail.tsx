import React, { useEffect, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import TurnOverlay from './TurnOverlay';

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
const TOAST_DURATION_MS = 5000;
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
 * The single top-center column. The turn status bar (phase, undo, end turn)
 * sits first, then the your-turn toast, then each "waiting on X / do Y"
 * notice — all stacked here so they can never overlap.
 */
const NoticeRail: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { chooseKnightEffect } = useSocket();
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

  // Game over: no turn bar or turn notices — the victory overlay takes over.
  if (!gameRoom || gameRoom.gameStatus === 'finished') return null;
  // Spectators get just the turn bar (whose turn it is); the notices below
  // are all addressed to a seat.
  if (!currentPlayer) {
    return (
      <div className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
        <TurnOverlay />
      </div>
    );
  }

  // Build the list of action/waiting notices, highest-priority first.
  const notices: { key: string; mine: boolean; text: React.ReactNode }[] = [];
  if (currentPlayer.eliminated && gameRoom.gameStatus === 'playing') {
    notices.push({
      key: 'knocked-out',
      mine: false,
      text: '💀 You have been knocked out (no settlements, cities, or soldiers left). You can keep spectating.',
    });
  }
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
  if (gameRoom.devCardChoice?.card === 'knight' && gameRoom.devCardChoice.spawn && gameRoom.devCardChoice.player === currentPlayer.name) {
    notices.push({
      key: 'knight-spawn',
      mine: true,
      text: (
        <span className="flex items-center gap-3">
          <span>🛡️ Knight: click a glowing ring to spawn a soldier there.</span>
          <button
            type="button"
            onClick={() => chooseKnightEffect(gameRoom.id, 'cancel')}
            className="px-2 py-0.5 rounded-md border border-amber-400 bg-white text-[12px] font-semibold text-amber-900 cursor-pointer hover:bg-amber-100"
          >
            Cancel
          </button>
        </span>
      ),
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
          ? currentPlayer.name in (gameRoom.discards ?? {})
            ? 'You rolled a 7 — discard first, then drag the robber to a new hex.'
            : pendingDiscards.length > 0
              ? 'You rolled a 7 — waiting for the others to discard, then drag the robber to a new hex.'
              : 'You rolled a 7 — drag the robber to a new hex.'
          : 'Knight: drag the robber to a new hex.'
        : `${player} must move the robber (${reason === 'seven' ? 'rolled a 7' : 'knight card'}).`,
    });
  }
  if (gameRoom.robberDefeatedBy) {
    const winner = gameRoom.robberDefeatedBy.playerName;
    const isMe = winner === currentPlayer.name;
    notices.push({
      key: 'robber-win',
      mine: isMe,
      text: isMe
        ? 'You defeated the robber — drag the black robber to a highlighted adjacent hex to move it.'
        : `${winner} defeated the robber and must move it to an adjacent hex.`,
    });
  }

  const phase = gameRoom.turnState.phase;
  const showToast = toastVisible && isMyTurn;

  return (
    // z-40: above the board and its controls, but under every modal (z-50:
    // battle, steal, discard…) so the turn bar never covers a modal.
    <div className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
      <TurnOverlay />
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
