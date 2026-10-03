import React, { useState } from 'react';
import { Price, RESOURCES, ResourceKey, TradeOffer, BuildCheck, hasAnyResource, covers, canBankTrade, bestBankTradeRatio, diceOwner } from 'common';
import { ReasonNotice } from './ReasonNotice';
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
  canAccept: boolean;
  canTake: boolean;
}> = ({ offer, canAccept, canTake }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { acceptTrade, declineTrade, cancelTrade, takeTrade } = useSocket();
  if (!gameRoom || !currentPlayer) return null;

  const me = currentPlayer.name;
  const roomId = gameRoom.id;
  const btn = 'px-2 py-1 text-[12px] rounded border cursor-pointer';
  const isOpen = offer.to === null;
  const iAmCreator = offer.from === me;
  const iAmClaimer = offer.claimer === me;
  const iAmRecipient = offer.to === me;

  let description: React.ReactNode;
  if (isOpen && !offer.claimer) {
    description = (
      <><strong>{offer.from}</strong> offers <strong>{priceLabel(offer.give)}</strong> for <strong>{priceLabel(offer.want)}</strong> <span className="text-gray-400">(open to anyone)</span></>
    );
  } else if (isOpen && iAmClaimer) {
    description = (
      <>You took <strong>{offer.from}</strong>'s offer: they give <strong>{priceLabel(offer.give)}</strong>, you give <strong>{priceLabel(offer.want)}</strong></>
    );
  } else if (isOpen && iAmCreator) {
    description = (
      <><strong>{offer.claimer}</strong> took your offer: you give <strong>{priceLabel(offer.give)}</strong>, they give <strong>{priceLabel(offer.want)}</strong></>
    );
  } else if (iAmCreator) {
    description = (
      <>You offer <strong>{priceLabel(offer.give)}</strong> for <strong>{priceLabel(offer.want)}</strong> from <strong>{offer.to}</strong></>
    );
  } else {
    description = (
      <><strong>{offer.from}</strong> offers you <strong>{priceLabel(offer.give)}</strong> for your <strong>{priceLabel(offer.want)}</strong></>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md p-2 mb-2 bg-white">
      <p className="text-[13px] m-0">{description}</p>

      {offer.status === 'pending' && (
        <div className="flex gap-2 mt-1.5">
          {iAmCreator ? (
            <>
              {/* Open offer that someone took: creator accepts or declines. */}
              {isOpen && offer.claimer && (
                <>
                  {canAccept && (
                    <button type="button" className={`${btn} border-green-700 bg-green-600 text-white`} onClick={() => acceptTrade(roomId, offer.id)}>
                      Accept {offer.claimer}
                    </button>
                  )}
                  <button type="button" className={`${btn} border-red-300 bg-red-50 text-red-700`} onClick={() => declineTrade(roomId, offer.id)}>
                    Decline
                  </button>
                </>
              )}
              <button type="button" className={`${btn} border-gray-300 bg-gray-100`} onClick={() => cancelTrade(roomId, offer.id)}>
                Cancel
              </button>
            </>
          ) : isOpen && !offer.claimer ? (
            // Open offer I haven't taken: take it.
            canTake && (
              <button type="button" className={`${btn} border-blue-700 bg-blue-600 text-white`} onClick={() => takeTrade(roomId, offer.id)}>
                Take offer
              </button>
            )
          ) : iAmClaimer ? (
            // I took an open offer; withdraw my claim.
            <button type="button" className={`${btn} border-gray-300 bg-gray-100`} onClick={() => declineTrade(roomId, offer.id)}>
              Withdraw
            </button>
          ) : iAmRecipient ? (
            // Directed offer to me.
            <>
              {canAccept && (
                <button type="button" className={`${btn} border-green-700 bg-green-600 text-white`} title="Accept this trade" onClick={() => acceptTrade(roomId, offer.id)}>
                  Accept
                </button>
              )}
              <button type="button" className={`${btn} border-red-300 bg-red-50 text-red-700`} onClick={() => declineTrade(roomId, offer.id)}>
                Decline
              </button>
            </>
          ) : null}
        </div>
      )}

      {offer.status !== 'pending' && (
        <p className="text-[12px] text-gray-500 mt-1 m-0 capitalize">Status: {offer.status}</p>
      )}
    </div>
  );
};


/** A trade action button: always visible, greyed out (keeps normal text) when
 *  unavailable; clicking a greyed one reports the reason. */
const TradeButton: React.FC<{
  label: React.ReactNode;
  check: BuildCheck;
  color: string; // enabled tailwind classes, e.g. 'bg-green-600 border-green-600'
  onDo: () => void;
  onBlocked: (reason: string) => void;
}> = ({ label, check, color, onDo, onBlocked }) => (
  <button
    type="button"
    onClick={() => (check.allowed ? onDo() : onBlocked(check.reason ?? 'Not allowed'))}
    aria-disabled={!check.allowed}
    className={`w-full py-1.5 text-[13px] font-semibold rounded-md border text-white ${
      check.allowed ? `${color} cursor-pointer` : 'bg-gray-300 border-gray-300 cursor-not-allowed'
    }`}
  >
    {label}
  </button>
);
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
  const [notice, setNotice] = useState<string | null>(null);
  if (!gameRoom || !currentPlayer) return null;

  const isBank = counterparty === 'Bank';
  const isOpenTarget = counterparty === 'Anyone';
  const others = gameRoom.players.filter((p) => p.name !== currentPlayer.name);
  const offers = gameRoom.tradeOffers ?? [];
  const me = currentPlayer.name;
  const isOpenOffer = (o: TradeOffer) => o.to === null && o.status === 'pending';
  // Needing my decision: a direct offer to me, or an open offer I made that
  // someone has taken (I then accept or decline the taker).
  const incoming = offers.filter(
    (o) => o.status === 'pending' && (o.to === me || (isOpenOffer(o) && o.from === me && !!o.claimer))
  );
  // Open offers posted by others that no one has taken yet.
  const openOffers = offers.filter((o) => isOpenOffer(o) && o.from !== me && !o.claimer);
  // My pending offers (directed + open, claimed or not).
  const outgoing = offers.filter((o) => o.from === me && o.status === 'pending');
  const turnOwner = diceOwner(gameRoom);
  const isTurnOwner = turnOwner === me;

  // Bank ratio for the selected give resource (port-aware).
  const bankRatio = gameRoom.board ? bestBankTradeRatio(gameRoom.board, currentPlayer, bankGive) : 4;
  const bankCheck: BuildCheck = !isTurnOwner
    ? { allowed: false, reason: 'Not your turn' }
    : !gameRoom.board
    ? { allowed: false, reason: 'Board not ready' }
    : canBankTrade(gameRoom, currentPlayer.name, bankGive, bankWant, bankCount, gameRoom.bankSupply);
  const offerCheck: BuildCheck = !isTurnOwner
    ? { allowed: false, reason: 'Not your turn' }
    : !hasAnyResource(give)
    ? { allowed: false, reason: 'Pick at least one resource to give' }
    : { allowed: true, reason: null };
  const setGiveAmount = (k: ResourceKey, v: number) => setGive({ ...give, [k]: v });
  const setWantAmount = (k: ResourceKey, v: number) => setWant({ ...want, [k]: v });

  const submitBank = () => {
    if (!bankCheck.allowed) return;
    bankTrade(gameRoom.id, bankGive, bankWant, bankCount);
    setBankCount(4);
  };
  const submitOffer = () => {
    if (!offerCheck.allowed || !counterparty || isBank) return;
    // 'Anyone' posts an open offer (to === null) any player can take.
    createTradeOffer(gameRoom.id, isOpenTarget ? null : counterparty, give, want);
    setGive({ ...emptyPrice });
    setWant({ ...emptyPrice });
  };

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
        <option value="Anyone">Anyone (post offer)</option>
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
          <TradeButton
            label="Trade with Bank"
            check={bankCheck}
            color="bg-green-600 border-green-600"
            onDo={submitBank}
            onBlocked={setNotice}
          />
          {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
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

          <TradeButton
            label="Send Offer"
            check={offerCheck}
            color="bg-blue-600 border-blue-600"
            onDo={submitOffer}
            onBlocked={setNotice}
          />
          {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
        </div>
      )}

      {/* Incoming */}
      <h4 className="text-[13px] font-semibold m-0 mt-4 mb-2">Incoming ({incoming.length})</h4>
      {incoming.length === 0 ? (
        <p className="text-[12px] text-gray-500 m-0">No pending offers for you.</p>
      ) : (
        incoming.map((o) => {
          const from = gameRoom.players.find((p) => p.name === o.from);
          // Counterparty: the directed recipient, or the player who took an
          // open offer.
          const cpName = o.to ?? o.claimer ?? null;
          const counter = cpName ? gameRoom.players.find((p) => p.name === cpName) : undefined;
          // Mirror of the backend's affordability check using only public
          // data: an opponent's hand is masked, so exact resources can't be
          // checked — resourceCount is the only affordability signal
          // available (the server still enforces the real check).
          const canAfford = (p: typeof from, price: Price) =>
            !!p && (p.id === currentPlayer.id
              ? covers(p.resources, price)
              : p.resourceCount >= Object.values(price).reduce((a, b) => a + b, 0));
          const openClaimed = isOpenOffer(o) && o.from === me && !!o.claimer;
          const canAccept =
            o.status === 'pending' &&
            (o.to === me ? (turnOwner === o.from || turnOwner === o.to) : openClaimed) &&
            canAfford(from, o.give) &&
            canAfford(counter, o.want);
          return (
            <OfferRow
              key={o.id}
              offer={o}
              canAccept={canAccept}
              canTake={false}
            />
          );
        })
      )}

      {/* Open offers: anyone can take; the poster then accepts or declines. */}
      <h4 className="text-[13px] font-semibold m-0 mt-4 mb-2">Open offers ({openOffers.length})</h4>
      {openOffers.length === 0 ? (
        <p className="text-[12px] text-gray-500 m-0">No open offers right now.</p>
      ) : (
        openOffers.map((o) => {
          const canTake = o.status === 'pending' && !o.claimer && covers(currentPlayer.resources, o.want);
          return (
            <OfferRow key={o.id} offer={o} canAccept={false} canTake={canTake} />
          );
        })
      )}

      {/* Outgoing */}
      <h4 className="text-[13px] font-semibold m-0 mt-4 mb-2">Outgoing ({outgoing.length})</h4>
      {outgoing.length === 0 ? (
        <p className="text-[12px] text-gray-500 m-0">No pending offers from you.</p>
      ) : (
        outgoing.map((o) => (
          <OfferRow key={o.id} offer={o} canAccept={false} canTake={false} />
        ))
      )}
    </div>
  );
};

export default TradeTab;
