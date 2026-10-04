import React, { useState } from 'react';
import { Price, PortType, RESOURCES, ResourceKey, TradeOffer, BuildCheck, hasAnyResource, covers, canBankTrade, bestBankTradeRatio, diceOwner } from 'common';
import { ReasonNotice } from './ReasonNotice';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import { priceLabel } from '../../utils/price';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';
import { emptyPrice } from '../../constants';

/** Small round +/- button used by every amount control. */
const stepperBtn =
  'w-5 h-5 flex items-center justify-center rounded-full border border-gray-300 bg-white text-[12px] font-bold text-gray-600 cursor-pointer hover:border-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed';

/** A player-color dot. */
const Dot: React.FC<{ color?: string; size?: number }> = ({ color, size = 10 }) => (
  <span
    className="inline-block rounded-full border border-black/10 shrink-0"
    style={{ width: size, height: size, background: color ?? '#9ca3af' }}
    aria-hidden="true"
  />
);

/** A price as icon chips (e.g. [2 🌾] [1 ⛏️]); red for what you give, green for what you get. */
const PriceChips: React.FC<{ price: Price; tone: 'give' | 'get' }> = ({ price, tone }) => {
  const parts = RESOURCES.filter((k) => price[k] > 0);
  if (parts.length === 0) return <span className="text-[12px] text-gray-400 italic">nothing</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {parts.map((k) => (
        <span
          key={k}
          title={`${price[k]} ${k}`}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[13px] font-semibold ${
            tone === 'give' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {price[k]} {RESOURCE_ICONS[k]}
        </span>
      ))}
    </span>
  );
};

/** Compact −/value/+ control for one resource amount in the offer grid. */
const Counter: React.FC<{ value: number; max?: number; onChange: (v: number) => void; tone: 'give' | 'get' }> = ({
  value,
  max,
  onChange,
  tone,
}) => (
  <div
    className={`flex items-center justify-center gap-0.5 rounded-md py-1 ${
      value > 0 ? (tone === 'give' ? 'bg-red-50' : 'bg-green-50') : 'bg-gray-50'
    }`}
  >
    <button type="button" className={stepperBtn} disabled={value === 0} onClick={() => onChange(value - 1)} aria-label="Less">
      −
    </button>
    <span className={`w-4 text-center text-[13px] font-bold ${value > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{value}</span>
    <button
      type="button"
      className={stepperBtn}
      disabled={max !== undefined && value >= max}
      onClick={() => onChange(value + 1)}
      aria-label="More"
    >
      +
    </button>
  </div>
);

/** A section heading with an optional count pill. */
const SectionTitle: React.FC<{ children: React.ReactNode; count?: number; accent?: string }> = ({ children, count, accent }) => (
  <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-gray-500 m-0 mb-2">
    {children}
    {count !== undefined && (
      <span className={`px-1.5 rounded-full text-[11px] font-bold text-white ${accent ?? 'bg-gray-400'}`}>{count}</span>
    )}
  </h4>
);

/** One trade offer as a card: who, what you give / get, and its action buttons. */
const OfferCard: React.FC<{
  offer: TradeOffer;
  canAccept: boolean;
  canTake: boolean;
  /** Why I can't act on this offer (shown instead of a missing button). */
  blockedReason?: string | null;
}> = ({ offer, canAccept, canTake, blockedReason }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { acceptTrade, declineTrade, cancelTrade, takeTrade } = useSocket();
  if (!gameRoom || !currentPlayer) return null;

  const me = currentPlayer.name;
  const roomId = gameRoom.id;
  const colorOf = (name: string | null) => gameRoom.players.find((p) => p.name === name)?.color;
  const isOpen = offer.to === null;
  const iAmCreator = offer.from === me;
  const iAmClaimer = offer.claimer === me;
  const iAmRecipient = offer.to === me;

  // From my seat: the creator gives `give` and gets `want`; everyone else the reverse.
  const myGive = iAmCreator ? offer.give : offer.want;
  const myGet = iAmCreator ? offer.want : offer.give;

  // Who the card is about, plus a one-line status.
  let who: string;
  let status: string;
  if (isOpen && iAmCreator) {
    who = offer.claimer ?? 'Anyone';
    status = offer.claimer ? 'took your open offer' : 'your open offer · waiting for a taker';
  } else if (isOpen && iAmClaimer) {
    who = offer.from;
    status = 'you accepted this open offer';
  } else if (isOpen) {
    who = offer.from;
    status = 'open offer to anyone';
  } else if (iAmCreator) {
    who = offer.to ?? '';
    status = 'your offer · waiting for an answer';
  } else {
    who = offer.from;
    status = 'offers you a trade';
  }

  const btn = 'px-3 py-1 text-[12px] font-semibold rounded-full border cursor-pointer transition-colors';
  const accept = `${btn} border-green-700 bg-green-600 text-white hover:bg-green-700`;
  const decline = `${btn} border-red-200 bg-white text-red-700 hover:bg-red-50`;
  const neutral = `${btn} border-gray-300 bg-white text-gray-700 hover:bg-gray-100`;
  const take = `${btn} border-blue-700 bg-blue-600 text-white hover:bg-blue-700`;

  // I took an open offer: the poster must still accept me.
  const awaitingPoster = isOpen && iAmClaimer && offer.status === 'pending';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 mb-2 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        {who === 'Anyone' ? <span aria-hidden="true">📢</span> : <Dot color={colorOf(who)} />}
        <strong className="text-[13px] text-gray-800">{who}</strong>
        <span className="text-[12px] text-gray-500 truncate">{status}</span>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold text-red-700">You give</span>
        <PriceChips price={myGive} tone="give" />
        <span className="text-[11px] font-semibold text-green-700">You get</span>
        <PriceChips price={myGet} tone="get" />
      </div>

      {awaitingPoster && (
        <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-[12px] text-blue-800">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" aria-hidden="true" />
          <span>
            Waiting for <strong>{offer.from}</strong> to accept your offer…
          </span>
        </div>
      )}

      {offer.status === 'pending' && (
        <div className="flex flex-wrap justify-end gap-2 mt-2">
          {iAmCreator ? (
            <>
              {/* Open offer that someone took: creator accepts or declines. */}
              {isOpen && offer.claimer && (
                <>
                  {canAccept && (
                    <button type="button" className={accept} onClick={() => acceptTrade(roomId, offer.id)}>
                      Accept {offer.claimer}
                    </button>
                  )}
                  <button type="button" className={decline} onClick={() => declineTrade(roomId, offer.id)}>
                    Decline
                  </button>
                </>
              )}
              <button type="button" className={neutral} onClick={() => cancelTrade(roomId, offer.id)}>
                Cancel
              </button>
            </>
          ) : isOpen && !offer.claimer ? (
            // Open offer I haven't taken: take it.
            canTake && (
              <button type="button" className={take} onClick={() => takeTrade(roomId, offer.id)}>
                Take offer
              </button>
            )
          ) : iAmClaimer ? (
            // I took an open offer; withdraw my claim.
            <button type="button" className={neutral} onClick={() => declineTrade(roomId, offer.id)}>
              Withdraw
            </button>
          ) : iAmRecipient ? (
            // Directed offer to me.
            <>
              <button type="button" className={decline} onClick={() => declineTrade(roomId, offer.id)}>
                Decline
              </button>
              {canAccept && (
                <button type="button" className={accept} onClick={() => acceptTrade(roomId, offer.id)}>
                  Accept
                </button>
              )}
            </>
          ) : null}
        </div>
      )}

      {offer.status === 'pending' && blockedReason && (
        <p className="text-[12px] text-amber-700 mt-1.5 m-0">🔒 {blockedReason}</p>
      )}

      {offer.status !== 'pending' && (
        <p className="text-[12px] text-gray-500 mt-1.5 m-0 capitalize">Status: {offer.status}</p>
      )}
    </div>
  );
};

/** A trade action button: always visible, greyed out when unavailable;
 *  clicking a greyed one reports the reason. */
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
    className={`w-full py-2 text-[14px] font-bold rounded-lg border-2 text-white shadow-sm ${
      check.allowed ? `${color} cursor-pointer` : 'bg-gray-300 border-gray-300 cursor-not-allowed'
    }`}
  >
    {label}
  </button>
);

/**
 * Trade tab: pick who to trade with (Bank, Anyone, or a player) from a row of
 * chips, then fill in the matching form. Trades are allowed only on your turn
 * (you rolled the dice). The bank shows each resource's port-aware ratio
 * (2:1 special, 3:1 generic, 4:1). Offers are grouped by what they need from
 * you; empty groups are hidden.
 */
const TradeTab: React.FC<{
  /** Port clicked to open the window: presets the Bank form (its resource as the give). */
  port?: PortType | null;
}> = ({ port = null }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { createTradeOffer, bankTrade } = useSocket();
  // A port click opens straight on the Bank form.
  const [counterparty, setCounterparty] = useState(port ? 'Bank' : '');
  const ratioFor = (k: ResourceKey) =>
    gameRoom?.board && currentPlayer ? bestBankTradeRatio(gameRoom.board, currentPlayer, k) : 4;
  // Bank form: give `bankCount` of `bankGive` for `bankWant`. A resource
  // port presets its resource as the give (a generic port leaves it alone).
  const portGive = port && port !== 'generic' ? (port as ResourceKey) : null;
  const [bankGive, setBankGive] = useState<ResourceKey>(portGive ?? 'Wood');
  const [bankWant, setBankWant] = useState<ResourceKey>(portGive === 'Brick' ? 'Wood' : 'Brick');
  // Always a whole batch of the give resource's ratio (a 3:1 port can't trade 4).
  const [bankCount, setBankCount] = useState(() => ratioFor(portGive ?? 'Wood'));
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
  // Waiting on someone else: my pending offers, plus open offers I took
  // (the poster still has to accept me).
  const outgoing = offers.filter(
    (o) => o.status === 'pending' && !incoming.includes(o) && (o.from === me || (o.to === null && o.claimer === me))
  );
  const turnOwner = diceOwner(gameRoom);
  const isTurnOwner = turnOwner === me;
  const turnOwnerColor = gameRoom.players.find((p) => p.name === turnOwner)?.color;

  // Bank ratio for the selected give resource (port-aware).
  const bankRatio = ratioFor(bankGive);
  const bankGet = Math.floor(bankCount / bankRatio);
  const bankMaxBatches = Math.floor(currentPlayer.resources[bankGive] / bankRatio);
  const bankCheck: BuildCheck = !isTurnOwner
    ? { allowed: false, reason: 'Not your turn' }
    : !gameRoom.board
    ? { allowed: false, reason: 'Board not ready' }
    : canBankTrade(gameRoom, currentPlayer.name, bankGive, bankWant, bankCount, gameRoom.bankSupply);
  const offerCheck: BuildCheck = !isTurnOwner
    ? { allowed: false, reason: 'Not your turn' }
    : !hasAnyResource(give)
    ? { allowed: false, reason: 'Pick at least one resource to give' }
    : !hasAnyResource(want)
    ? { allowed: false, reason: 'Pick at least one resource you want' }
    : { allowed: true, reason: null };
  const setGiveAmount = (k: ResourceKey, v: number) => setGive({ ...give, [k]: v });
  const setWantAmount = (k: ResourceKey, v: number) => setWant({ ...want, [k]: v });

  const pickBankGive = (k: ResourceKey) => {
    // Keep give and get different: picking the current get swaps them.
    if (k === bankWant) setBankWant(bankGive);
    setBankGive(k);
    setBankCount(ratioFor(k));
    setNotice(null);
  };
  const pickBankWant = (k: ResourceKey) => {
    if (k === bankGive) {
      setBankGive(bankWant);
      setBankCount(ratioFor(bankWant));
    }
    setBankWant(k);
    setNotice(null);
  };
  const submitBank = () => {
    if (!bankCheck.allowed) return;
    bankTrade(gameRoom.id, bankGive, bankWant, bankCount);
    setBankCount(bankRatio);
  };
  const submitOffer = () => {
    if (!offerCheck.allowed || !counterparty || isBank) return;
    // 'Anyone' posts an open offer (to === null) any player can take.
    createTradeOffer(gameRoom.id, isOpenTarget ? null : counterparty, give, want);
    setGive({ ...emptyPrice });
    setWant({ ...emptyPrice });
  };

  const targets: { value: string; label: string; icon?: string; color?: string; sub?: string }[] = [
    { value: 'Bank', label: 'Bank', icon: '🏦' },
    { value: 'Anyone', label: 'Anyone', icon: '📢' },
    ...others.map((p) => ({ value: p.name, label: p.name, color: p.color, sub: `${p.resourceCount} 🃏` })),
  ];

  const tile = (selected: boolean) =>
    `flex flex-col items-center gap-0.5 rounded-lg border-2 py-1.5 cursor-pointer transition-all ${
      selected ? 'border-blue-600 bg-blue-50 shadow-sm scale-[1.04]' : 'border-gray-200 bg-white hover:border-gray-400'
    }`;

  // Offers, grouped and ordered by what they need from me.
  const decorateIncoming = (o: TradeOffer) => {
    const from = gameRoom.players.find((p) => p.name === o.from);
    // Counterparty: the directed recipient, or the player who took an open offer.
    const cpName = o.to ?? o.claimer ?? null;
    const counter = cpName ? gameRoom.players.find((p) => p.name === cpName) : undefined;
    // Mirror of the backend's affordability check using only public data: an
    // opponent's hand is masked, so resourceCount is the only signal (the
    // server still enforces the real check).
    const canAfford = (p: typeof from, price: Price) =>
      !!p &&
      (p.id === currentPlayer.id
        ? covers(p.resources, price)
        : p.resourceCount >= Object.values(price).reduce((a, b) => a + b, 0));
    const openClaimed = isOpenOffer(o) && o.from === me && !!o.claimer;
    const isDirectedToMe = o.to === me;
    const turnOk = !isDirectedToMe || turnOwner === o.from || turnOwner === o.to;
    const canAccept =
      o.status === 'pending' &&
      (isDirectedToMe ? turnOk : openClaimed) &&
      canAfford(from, o.give) &&
      canAfford(counter, o.want);
    const blockedReason = canAccept
      ? null
      : !turnOk
      ? `Can only be accepted on ${o.from}'s turn (it's ${turnOwner}'s turn now)`
      : !canAfford(from, o.give)
      ? `${o.from} can't afford their side right now`
      : !canAfford(counter, o.want)
      ? counter?.id === currentPlayer.id
        ? `You need ${priceLabel(o.want)} to accept`
        : `${cpName} can't afford their side right now`
      : null;
    return <OfferCard key={o.id} offer={o} canAccept={canAccept} canTake={false} blockedReason={blockedReason} />;
  };
  const hasOffers = incoming.length + openOffers.length + outgoing.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Who can trade right now: only the turn owner makes trades; everyone
          else can only respond to the turn owner's offers. */}
      {isTurnOwner ? (
        <div className="flex items-center gap-2 text-[13px] rounded-lg px-3 py-2 bg-green-600 text-white shadow-sm">
          <span aria-hidden="true">🤝</span>
          <span>
            <strong>Your turn</strong> — trade with the bank or any player.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] rounded-lg px-3 py-2 border border-amber-300 bg-amber-50 text-amber-900">
          <Dot color={turnOwnerColor} size={12} />
          <span>
            Only <strong>{turnOwner}</strong> can start trades right now. You can still answer their offers below.
          </span>
        </div>
      )}

      {isTurnOwner && (
        <section>
          <SectionTitle>Trade with</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {targets.map((t) => {
              const selected = counterparty === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setCounterparty(t.value);
                    setNotice(null);
                  }}
                  aria-pressed={selected}
                  className={`flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full border-2 text-[13px] font-semibold cursor-pointer transition-all ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white shadow'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {t.icon ? <span aria-hidden="true">{t.icon}</span> : <Dot color={t.color} size={12} />}
                  {t.label}
                  {t.sub && <span className={`text-[11px] font-normal ${selected ? 'text-blue-100' : 'text-gray-400'}`}>{t.sub}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isTurnOwner && isBank && (
        <section className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 flex flex-col gap-3">
          <div>
            <SectionTitle>You give</SectionTitle>
            <div className="grid grid-cols-5 gap-1.5">
              {RESOURCES.map((k) => (
                <button key={k} type="button" onClick={() => pickBankGive(k)} className={tile(bankGive === k)} title={k}>
                  <span className="text-2xl leading-none">{RESOURCE_ICONS[k]}</span>
                  <span className="text-[11px] text-gray-500">have {currentPlayer.resources[k]}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 rounded-full ${
                      ratioFor(k) < 4 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {ratioFor(k)}:1
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <SectionTitle>You get</SectionTitle>
            <div className="grid grid-cols-5 gap-1.5">
              {RESOURCES.map((k) => (
                <button key={k} type="button" onClick={() => pickBankWant(k)} className={tile(bankWant === k)} title={k}>
                  <span className="text-2xl leading-none">{RESOURCE_ICONS[k]}</span>
                  <span className="text-[11px] text-gray-500">bank {gameRoom.bankSupply[k]}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Amount: whole batches of the ratio. */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className={stepperBtn}
              disabled={bankCount <= bankRatio}
              onClick={() => setBankCount((c) => Math.max(bankRatio, c - bankRatio))}
              aria-label="Fewer"
            >
              −
            </button>
            <span className="flex items-center gap-2 text-[16px] font-bold">
              <span className="text-red-700">
                {bankCount} {RESOURCE_ICONS[bankGive]}
              </span>
              <span className="text-gray-400">→</span>
              <span className="text-green-700">
                {bankGet} {RESOURCE_ICONS[bankWant]}
              </span>
            </span>
            <button
              type="button"
              className={stepperBtn}
              disabled={bankCount / bankRatio >= bankMaxBatches}
              onClick={() => setBankCount((c) => c + bankRatio)}
              aria-label="More"
            >
              +
            </button>
          </div>
          <TradeButton
            label="Trade with Bank"
            check={bankCheck}
            color="bg-green-600 border-green-700 hover:bg-green-700"
            onDo={submitBank}
            onBlocked={setNotice}
          />
          {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
        </section>
      )}

      {isTurnOwner && counterparty !== '' && !isBank && (
        <section className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 flex flex-col gap-3">
          <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] items-center gap-x-1.5 gap-y-1.5">
            <span />
            {RESOURCES.map((k) => (
              <span key={k} className="text-center text-xl leading-none" title={k}>
                {RESOURCE_ICONS[k]}
              </span>
            ))}
            <span className="text-[12px] font-bold text-red-700 pr-1">You give</span>
            {RESOURCES.map((k) => (
              <Counter key={k} tone="give" value={give[k]} max={currentPlayer.resources[k]} onChange={(v) => setGiveAmount(k, v)} />
            ))}
            <span className="text-[12px] font-bold text-green-700 pr-1">You get</span>
            {RESOURCES.map((k) => (
              <Counter key={k} tone="get" value={want[k]} onChange={(v) => setWantAmount(k, v)} />
            ))}
            <span className="text-[11px] text-gray-400 pr-1">You have</span>
            {RESOURCES.map((k) => (
              <span key={k} className="text-center text-[11px] text-gray-400">
                {currentPlayer.resources[k]}
              </span>
            ))}
          </div>
          <TradeButton
            label={isOpenTarget ? '📢 Post to everyone' : `Send offer to ${counterparty}`}
            check={offerCheck}
            color="bg-blue-600 border-blue-700 hover:bg-blue-700"
            onDo={submitOffer}
            onBlocked={setNotice}
          />
          {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
        </section>
      )}

      {/* Offers, grouped by what they need from you; empty groups are hidden. */}
      {incoming.length > 0 && (
        <section>
          <SectionTitle count={incoming.length} accent="bg-red-600">
            Needs your answer
          </SectionTitle>
          {incoming.map(decorateIncoming)}
        </section>
      )}
      {openOffers.length > 0 && (
        <section>
          <SectionTitle count={openOffers.length} accent="bg-blue-600">
            Open offers
          </SectionTitle>
          {openOffers.map((o) => {
            const canTake = o.status === 'pending' && !o.claimer && covers(currentPlayer.resources, o.want);
            const blockedReason = canTake ? null : `You need ${priceLabel(o.want)} to take this offer`;
            return <OfferCard key={o.id} offer={o} canAccept={false} canTake={canTake} blockedReason={blockedReason} />;
          })}
        </section>
      )}
      {outgoing.length > 0 && (
        <section>
          <SectionTitle count={outgoing.length}>Your offers</SectionTitle>
          {outgoing.map((o) => (
            <OfferCard key={o.id} offer={o} canAccept={false} canTake={false} />
          ))}
        </section>
      )}
      {!hasOffers && <p className="text-[12px] text-gray-400 text-center m-0">No trade offers right now.</p>}
    </div>
  );
};

export default TradeTab;
