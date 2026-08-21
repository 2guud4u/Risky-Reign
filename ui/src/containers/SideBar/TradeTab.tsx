import React, { useState } from 'react';
import { Price, TradeOffer, hasAnyResource, canAcceptTradeOffer } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';

const RESOURCES = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'] as const;
type ResourceKey = (typeof RESOURCES)[number];

const emptyPrice: Price = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };

/** Compact +/- stepper for a single resource amount. */
const ResourceStepper: React.FC<{
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}> = ({ label, value, max, onChange }) => {
  const btnClass = 'w-5 h-5 flex items-center justify-center rounded border border-gray-300 bg-gray-100 cursor-pointer text-xs';
  return (
    <div className="flex items-center gap-1">
      <span className="text-[12px] w-10 truncate" title={label}>
        {label}
      </span>
      <button type="button" className={btnClass} onClick={() => onChange(Math.max(0, value - 1))}>
        −
      </button>
      <span className="text-[12px] w-5 text-center font-semibold">{value}</span>
      <button
        type="button"
        className={btnClass}
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
      >
        +
      </button>
    </div>
  );
};

/** One-line summary of a price like "2 Wood, 1 Sheep". */
const priceLabel = (p: Price): string => {
  const parts = RESOURCES.filter((k) => p[k] > 0).map((k) => `${p[k]} ${k}`);
  return parts.length ? parts.join(', ') : 'nothing';
};

/** A single trade offer row with its action buttons. */
const OfferRow: React.FC<{
  offer: TradeOffer;
  mine: boolean;
  canAccept: boolean; // recipient's Trade phase AND both players can afford their parts
  acceptReason?: string | null; // why accepting is currently blocked (shown as tooltip)
}> = ({ offer, mine, canAccept, acceptReason }) => {
  const { gameRoom } = useGameRoom();
  const { acceptTrade, declineTrade, cancelTrade } = useSocket();
  if (!gameRoom) return null;

  const roomId = gameRoom.id;
  const btn = 'px-2 py-1 text-[12px] rounded border cursor-pointer';

  return (
    <div className="border border-gray-200 rounded-md p-2 mb-2 bg-white">
      <p className="text-[13px] m-0">
        {mine ? (
          <>You offer <strong>{priceLabel(offer.give)}</strong> for <strong>{priceLabel(offer.want)}</strong> from <strong>{offer.to}</strong></>
        ) : (
          <><strong>{offer.from}</strong> offers you <strong>{priceLabel(offer.give)}</strong> for your <strong>{priceLabel(offer.want)}</strong></>
        )}
      </p>

      {offer.status === 'pending' && (
        <div className="flex gap-2 mt-1.5">
          {mine ? (
            <button
              type="button"
              className={`${btn} border-gray-300 bg-gray-100`}
              onClick={() => cancelTrade(roomId, offer.id)}
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${btn} ${
                  canAccept ? 'border-green-700 bg-green-600 text-white' : 'border-gray-300 bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!canAccept}
                title={canAccept ? 'Accept this trade' : acceptReason ?? 'Cannot accept this trade right now'}
                onClick={() => acceptTrade(roomId, offer.id)}
              >
                Accept
              </button>
              <button
                type="button"
                className={`${btn} border-red-300 bg-red-50 text-red-700`}
                onClick={() => declineTrade(roomId, offer.id)}
              >
                Decline
              </button>
            </>
          )}
        </div>
      )}

      {offer.status !== 'pending' && (
        <p className="text-[12px] text-gray-500 mt-1 m-0 capitalize">Status: {offer.status}</p>
      )}
    </div>
  );
};

/**
 * Trade tab: draft an offer anytime; accept only on your turn.
 */
const TradeTab: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { createTradeOffer } = useSocket();
  const [recipient, setRecipient] = useState('');
  const [give, setGive] = useState<Price>({ ...emptyPrice });
  const [want, setWant] = useState<Price>({ ...emptyPrice });

  if (!gameRoom || !currentPlayer) return null;

  const others = gameRoom.players.filter((p) => p.name !== currentPlayer.name);
  const offers = gameRoom.tradeOffers ?? [];
  const incoming = offers.filter((o) => o.to === currentPlayer.name && o.status === 'pending');
  const outgoing = offers.filter((o) => o.from === currentPlayer.name && o.status === 'pending');

  const setGiveAmount = (k: ResourceKey, v: number) => setGive({ ...give, [k]: v });
  const setWantAmount = (k: ResourceKey, v: number) => setWant({ ...want, [k]: v });

  const submitOffer = () => {
    if (!recipient || !hasAnyResource(give)) return;
    createTradeOffer(gameRoom.id, recipient, give, want);
    setGive({ ...emptyPrice });
    setWant({ ...emptyPrice });
  };

  return (
    <div>
      {/* New offer */}
      <h4 className="text-[13px] font-semibold m-0 mb-2">New Offer</h4>
      <select
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-[13px] mb-2"
      >
        <option value="">Trade with...</option>
        {others.map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="mb-1">
        <p className="text-[12px] text-gray-600 m-0 mb-1">I give:</p>
        <div className="flex flex-col gap-1">
          {RESOURCES.map((k) => (
            <ResourceStepper key={k} label={k} value={give[k]} max={currentPlayer.resources[k]} onChange={(v) => setGiveAmount(k, v)} />
          ))}
        </div>
      </div>

      <div className="mb-2">
        <p className="text-[12px] text-gray-600 m-0 mb-1">I want:</p>
        <div className="flex flex-col gap-1">
          {RESOURCES.map((k) => (
            <ResourceStepper key={k} label={k} value={want[k]} onChange={(v) => setWantAmount(k, v)} />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={submitOffer}
        disabled={!recipient || !hasAnyResource(give)}
        className={`w-full py-1.5 text-[13px] font-semibold rounded-md border ${
          recipient && hasAnyResource(give)
            ? 'bg-blue-600 text-white border-blue-600 cursor-pointer'
            : 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed'
        }`}
      >
        Send Offer
      </button>

      {/* Incoming */}
      <h4 className="text-[13px] font-semibold m-0 mt-4 mb-2">Incoming ({incoming.length})</h4>
      {incoming.length === 0 ? (
        <p className="text-[12px] text-gray-500 m-0">No pending offers for you.</p>
      ) : (
        incoming.map((o) => {
          // Use the exact same check as the backend so the button state matches server rules.
          const check = canAcceptTradeOffer(gameRoom, o, currentPlayer.name);
          return (
            <OfferRow
              key={o.id}
              offer={o}
              mine={false}
              canAccept={check.allowed}
              acceptReason={check.reason}
            />
          );
        })
      )}
      {incoming.length > 0 && (
        <p className="text-[12px] text-gray-500 m-0">
          You can accept an offer while either player is in their Trade phase.
        </p>
      )}

      {/* Outgoing */}
      <h4 className="text-[13px] font-semibold m-0 mt-4 mb-2">Outgoing ({outgoing.length})</h4>
      {outgoing.length === 0 ? (
        <p className="text-[12px] text-gray-500 m-0">No pending offers from you.</p>
      ) : (
        outgoing.map((o) => (
          <OfferRow key={o.id} offer={o} mine canAccept={false} />
        ))
      )}
    </div>
  );
};

export default TradeTab;
