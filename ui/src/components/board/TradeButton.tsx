import React, { useEffect, useState } from 'react';
import { diceOwner, PortType } from 'common';
import { useGameState } from '../../contexts/GameContext';
import TradeTab from '../../containers/game/TradeTab';
import Modal from '../ui/Modal';
import { RefreshCw } from 'lucide-react';
import MapIconButton from '../ui/MapIconButton';
import GameIcon from '../ui/GameIcon';
import { OpenTradeDetail } from '../../types/openTrade';
import { onEffect } from '../../effects';

/** localStorage flag: the player has opened the trade window at least once. */
const TRADE_SEEN_KEY = 'tradeWindowSeen';

function readTradeSeen(): boolean {
  try {
    return localStorage.getItem(TRADE_SEEN_KEY) === '1';
  } catch {
    // Storage unavailable: still pulse (the flag then lasts for this page).
    return false;
  }
}

/**
 * 🔄 button in the top-left corner of the map that opens the trade window
 * (`TradeTab`). While you can trade (your turn) it is solid green with a
 * "Trade" tag; otherwise it is greyed (the tooltip names the player who can
 * trade). Until the player first opens the trade window, the green button
 * also pulses; after that (remembered across games) it stays still. The red
 * badge counts offers waiting on your decision: a direct offer to you,
 * another player's open ("Anyone") offer nobody has taken yet, or an open
 * offer of yours that someone took.
 */
const TradeButton: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const [open, setOpen] = useState(false);
  // Port clicked to open the window (presets the bank form); null = 🔄 button.
  const [port, setPort] = useState<PortType | null>(null);
  // The pulsing halo only teaches where trading is: stop once it's been opened.
  const [tradeSeen, setTradeSeen] = useState(readTradeSeen);
  useEffect(() => {
    if (!open || tradeSeen) return;
    setTradeSeen(true);
    try {
      localStorage.setItem(TRADE_SEEN_KEY, '1');
    } catch {
      // Storage unavailable — the halo stays off for this page only.
    }
  }, [open, tradeSeen]);

  // A port click on the board opens the window on that port's bank trade.
  useEffect(() => {
    const onOpen = (detail: OpenTradeDetail) => {
      setPort(detail?.port ?? null);
      setOpen(true);
    };
    return onEffect('openTrade', onOpen);
  }, []);

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
    (o) =>
      o.status === 'pending' &&
      (o.to === me ||
        (o.to === null && o.from !== me && !o.claimer) ||
        (o.to === null && o.from === me && !!o.claimer))
  ).length;
  const turnOwner = diceOwner(gameRoom);
  const canTrade = turnOwner === me;
  const tradeHint = canTrade ? 'Trade — your turn, you can trade' : `Trade — only ${turnOwner} can trade now`;

  return (
    <>
      <MapIconButton
        icon={<RefreshCw size={22} />}
        live={canTrade}
        onClick={() => {
          setPort(null);
          setOpen(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title={tradeHint}
        aria-label={waiting > 0 ? `${tradeHint} (${waiting} offer${waiting === 1 ? '' : 's'} waiting)` : tradeHint}
        className={`top-2 left-[max(0.5rem,env(safe-area-inset-left))] ${canTrade ? '' : 'opacity-80'}`}
      >
        {canTrade && !tradeSeen && (
          // Soft pulsing halo: "you can trade now" (until first opened).
          <span className="trade-halo absolute inset-0 rounded-full bg-phase-build/60" aria-hidden="true" />
        )}
        {canTrade && (
          // Tag beside the button so the cue reads at a glance.
          <span
            className="absolute left-full ml-2 px-2 py-0.5 rounded-full bg-phase-build text-white text-[12px] font-bold whitespace-nowrap shadow pointer-events-none"
            aria-hidden="true"
          >
            Trade
          </span>
        )}
        {waiting > 0 && (
          // Red notification dot with the count; a white ring separates it from the map.
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-alert ring-2 ring-white text-white text-[11px] font-bold flex items-center justify-center">
            {waiting}
          </span>
        )}
      </MapIconButton>

      <Modal open={open} onClose={() => setOpen(false)} title={<><GameIcon name="trade" size={17} className="inline -mt-0.5" /> Trade</>} aria-label="Trade" width="max-w-[480px]">
        {/* Keyed by the port so a new port click re-presets the form. */}
        <TradeTab key={port ?? 'none'} port={port} />
      </Modal>
    </>
  );
};

export default TradeButton;
