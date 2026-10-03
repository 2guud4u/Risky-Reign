import React, { useEffect, useState } from 'react';
import { useGameRoom } from '../../contexts/GameContext';
import TradeTab from '../../containers/game/TradeTab';
import { backdropClass, modalCardClass } from '../../styles';

/**
 * 🤝 button in the top-left corner of the map that opens the trade window
 * (`TradeTab`). The red badge counts offers waiting on your decision: a direct
 * offer to you, or an open offer of yours that someone took.
 */
const TradeButton: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const [open, setOpen] = useState(false);

  // Escape closes the window (stopPropagation keeps the board's Escape
  // handler from also clearing the map selection).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open]);

  if (!gameRoom || !currentPlayer) return null;
  const me = currentPlayer.name;
  const waiting = (gameRoom.tradeOffers ?? []).filter(
    (o) => o.status === 'pending' && (o.to === me || (o.to === null && o.from === me && !!o.claimer))
  ).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseDown={(e) => e.stopPropagation()}
        title="Trade"
        aria-label={waiting > 0 ? `Trade (${waiting} offer${waiting === 1 ? '' : 's'} waiting)` : 'Trade'}
        className="absolute top-2 left-2 z-20 flex items-center justify-center w-12 h-12 rounded-full bg-white border-2 border-gray-300 shadow-lg text-2xl leading-none cursor-pointer hover:scale-110 hover:border-blue-500 transition-transform"
      >
        <span aria-hidden="true">🤝</span>
        {waiting > 0 && (
          // Red notification dot with the count; a white ring separates it from the map.
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 ring-2 ring-white text-white text-[11px] font-bold flex items-center justify-center">
            {waiting}
          </span>
        )}
      </button>

      {open && (
        <div
          className={backdropClass}
          onMouseDown={(e) => {
            // Click outside the card closes it.
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Trade"
            className={`${modalCardClass} max-w-[440px] max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="m-0 text-lg font-bold text-gray-800">🤝 Trade</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close trade"
                className="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <TradeTab />
          </div>
        </div>
      )}
    </>
  );
};

export default TradeButton;
