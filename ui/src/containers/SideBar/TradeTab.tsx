import React, { useState } from 'react';
import { Price, RESOURCES, ResourceKey, TradeOffer, hasAnyResource, canAcceptTradeOffer, canBankTrade, bestBankTradeRatio, diceOwner } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import { priceLabel } from '../../utils/price';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';
import { emptyPrice } from '../../constants';
/** Shared stepper button style (used by ResourceStepper and the bank form). */
const stepperBtn = 'w-5 h-5 flex items-center justify-center rounded border border-gray-300 bg-gray-100 cursor-pointer text-xs';

/** Compact +/- stepper for a single resource amount. */
const ResourceStepper: React.FC<{
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}> = ({ label, value, max, onChange }) => {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[12px] w-14 truncate" title={label}>
        {RESOURCE_ICONS[label as ResourceKey] ?? ''} {label}
      </span>
      <button type="button" className={stepperBtn} onClick={() => onChange(Math.max(0, value - 1))}>
        −
      </button>
      <span className="text-[12px] w-5 text-center font-semibold">{value}</span>
      <button
        type="button"
        className={stepperBtn}
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
      >
        +
      </button>
    </div>
  );
};

/** A single trade offer row with its action buttons. */
const OfferRow: React.FC<{
  offer: TradeOffer;
  mine: boolean;
  canAccept: boolean; // turn-owner gate AND both players can afford their parts
}> = ({ offer, mine, canAccept }) => {
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
              {canAccept && (
                <button
                  type="button"
                  className={`${btn} border-green-700 bg-green-600 text-white`}
                  title="Accept this trade"
                  onClick={() => acceptTrade(roomId, offer.id)}
                >
                  Accept
                </button>
              )}
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
 * Trade tab: a single form to trade with the bank or another player. The
 * counterparty is picked from one dropdown ("Bank" or a player). Trades are
 * allowed only on your turn (you rolled the dice). The bank ratio shown
 * reflects your settlements/cities on ports (2:1 special, 3:1 generic, 4:1).
 */
const TradeTab: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { createTradeOffer, bankTrade } = useSocket();
  const [counterparty, setCounterparty] = useState('');
  // Bank form: give `bankCount` of `bankGive` for `bankWant`.
  const [bankGive, setBankGive] = useState<ResourceKey>('Wood');
  const [bankWant, setBankWant] = useState<ResourceKey>('Brick');
  const [bankCount, setBankCount] = useState(4);
  // Player-offer form: multi-resource give/want.
  const [give, setGive] = useState<Price>({ ...emptyPrice });
  const [want, setWant] = useState<Price>({ ...emptyPrice });
  if (!gameRoom || !currentPlayer) return null;

  const isBank = counterparty === 'Bank';
  const others = gameRoom.players.filter((p) => p.name !== currentPlayer.name);
  const offers = gameRoom.tradeOffers ?? [];
  const incoming = offers.filter((o) => o.to === currentPlayer.name && o.status === 'pending');
  const outgoing = offers.filter((o) => o.from === currentPlayer.name && o.status === 'pending');
  const isTurnOwner = diceOwner(gameRoom) === currentPlayer.name;

  // Bank ratio for the selected give resource (port-aware).
  const bankRatio = gameRoom.board ? bestBankTradeRatio(gameRoom.board, currentPlayer, bankGive) : 4;
  const bankCanTrade =
    isTurnOwner && !!gameRoom.board &&
    canBankTrade(gameRoom, currentPlayer.name, bankGive, bankWant, bankCount, gameRoom.bankSupply).allowed;

  const setGiveAmount = (k: ResourceKey, v: number) => setGive({ ...give, [k]: v });
  const setWantAmount = (k: ResourceKey, v: number) => setWant({ ...want, [k]: v });

  const submitBank = () => {
    if (!bankCanTrade) return;
    bankTrade(gameRoom.id, bankGive, bankWant, bankCount);
    setBankCount(4);
  };
  const submitOffer = () => {
    if (!isTurnOwner || !counterparty || isBank || !hasAnyResource(give)) return;
    createTradeOffer(gameRoom.id, counterparty, give, want);
    setGive({ ...emptyPrice });
    setWant({ ...emptyPrice });
  };

  const primaryBtn = (active: string) =>
    `w-full py-1.5 text-[13px] font-semibold rounded-md border ${active} text-white cursor-pointer`;

  return (
    <div>
      <h4 className="text-[13px] font-semibold m-0 mb-2">New Trade</h4>
      <select
        value={counterparty}
        onChange={(e) => setCounterparty(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-[13px] mb-2"
      >
        <option value="">Trade with...</option>
        <option value="Bank">Bank</option>
        {others.map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>

      {counterparty === '' && (
        <p className="text-[12px] text-gray-500 m-0">Select who to trade with.</p>
      )}

      {isBank && (
        <div>
          <p className="text-[12px] text-gray-600 m-0 mb-2">
            Ratio: {bankRatio}:1 · Bank {bankWant}: {gameRoom.bankSupply[bankWant]}
          </p>
          <div className="flex gap-2 mb-2">
            <select
              value={bankGive}
              onChange={(e) => setBankGive(e.target.value as ResourceKey)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-[13px]"
            >
              {RESOURCES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <span className="text-[13px] text-gray-500 flex items-center">→</span>
            <select
              value={bankWant}
              onChange={(e) => setBankWant(e.target.value as ResourceKey)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-[13px]"
            >
              {RESOURCES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] text-gray-600">Give:</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setBankCount((c) => Math.max(1, c - 1))} className={stepperBtn}>-</button>
              <span className="text-[13px] font-mono w-8 text-center">{bankCount}</span>
              <button type="button" onClick={() => setBankCount((c) => Math.min(currentPlayer.resources[bankGive], c + 1))} className={stepperBtn}>+</button>
            </div>
          </div>
          {bankCanTrade && (
            <button
              type="button"
              onClick={submitBank}
              className={primaryBtn('bg-green-600 border-green-600')}
            >
              Trade with Bank
            </button>
          )}
        </div>
      )}

      {counterparty !== '' && !isBank && (
        <div>
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

          {isTurnOwner && hasAnyResource(give) && (
            <button
              type="button"
              onClick={submitOffer}
              className={primaryBtn('bg-blue-600 border-blue-600')}
            >
              Send Offer
            </button>
          )}
        </div>
      )}

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
            />
          );
        })
      )}
      {incoming.length > 0 && (
        <p className="text-[12px] text-gray-500 m-0">
          You can accept an offer during the turn owner's turn.
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
