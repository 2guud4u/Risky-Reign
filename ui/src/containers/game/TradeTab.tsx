import React, { useState } from 'react';
import { Price, PortType, RESOURCES, ResourceKey, TradeOffer, BuildCheck, hasAnyResource, covers, canBankTrade, bestBankTradeRatio, diceOwner } from 'common';
import { ReasonNotice } from './ReasonNotice';
import { useGameState } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import { priceLabel } from '../../utils/price';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';
import { emptyPrice } from '../../constants';
import GameIcon, { IconName } from '../../components/ui/GameIcon';
import Button from '../../components/ui/Button';
import Stepper from '../../components/ui/Stepper';
import ResourceTiles from '../../components/ui/ResourceTiles';
import OptionGrid from '../../components/ui/OptionGrid';
import { usePlayers } from '../../contexts/GameContext';


/** A player-color dot. */
const Dot: React.FC<{ color?: string; size?: number }> = ({ color, size = 10 }) => (
  <span
    className="inline-block rounded-full border border-black/10 shrink-0"
    style={{ width: size, height: size, background: color ?? '#9ca3af' }}
    aria-hidden="true"
  />
);

/** A price as icon chips (e.g. [2 🌾] [1 ⛏️]); clay for what you give, green for what you get. */
const PriceChips: React.FC<{ price: Price; tone: 'give' | 'get' }> = ({ price, tone }) => {
  const parts = RESOURCES.filter((k) => price[k] > 0);
  if (parts.length === 0) return <span className="text-[12px] text-ink-faint italic">nothing</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {parts.map((k) => (
        <span
          key={k}
          title={`${price[k]} ${k}`}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[13px] font-semibold ${
            tone === 'give' ? 'bg-clay-pale border-clay-soft/60 text-clay' : 'bg-phase-build/15 border-phase-build/60 text-phase-build'
          }`}
        >
          {price[k]} <GameIcon name={RESOURCE_ICONS[k]} size={14} className="inline -mt-0.5" />
        </span>
      ))}
    </span>
  );
};

/** Compact −/value/+ control for one resource amount in the offer grid —
 * the shared Stepper wrapped in a tone-tinted tray. */
const Counter: React.FC<{ value: number; max?: number; onChange: (v: number) => void; tone: 'give' | 'get' }> = ({
  value,
  max,
  onChange,
  tone,
}) => (
  <div
    className={`flex items-center justify-center rounded-md py-1 ${
      value > 0 ? (tone === 'give' ? 'bg-clay-pale' : 'bg-phase-build/15') : 'bg-canvas-sunken'
    }`}
  >
    <Stepper
      size="sm"
      value={value}
      onDecrement={() => onChange(value - 1)}
      onIncrement={() => onChange(value + 1)}
      canIncrement={max === undefined || value < max}
    />
  </div>
);

/** A section heading with an optional count pill. */
const SectionTitle: React.FC<{ children: React.ReactNode; count?: number; accent?: string }> = ({ children, count, accent }) => (
  <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-soft m-0 mb-2">
    {children}
    {count !== undefined && (
      <span className={`px-1.5 rounded-full text-[11px] font-bold text-white ${accent ?? 'bg-ink-faint'}`}>{count}</span>
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
  const { gameRoom, currentPlayer } = useGameState();
  const { acceptTrade, declineTrade, cancelTrade, takeTrade } = useSocket();
  const { colorOf } = usePlayers();
  if (!gameRoom || !currentPlayer) return null;

  const me = currentPlayer.name;
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

  const awaitingPoster = isOpen && iAmClaimer && offer.status === 'pending';

  return (
    <div className="rounded-lg border border-ink-faint/40 bg-canvas-raised p-2.5 mb-2 shadow-card">
      <div className="flex items-center gap-1.5 mb-2">
        {who === 'Anyone' ? <GameIcon name="megaphone" size={14} /> : <Dot color={colorOf(who)} />}
        <strong className="text-[13px] text-ink">{who}</strong>
        <span className="text-[12px] text-ink-soft truncate">{status}</span>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold text-clay">You give</span>
        <PriceChips price={myGive} tone="give" />
        <span className="text-[11px] font-semibold text-phase-build">You get</span>
        <PriceChips price={myGet} tone="get" />
      </div>

      {awaitingPoster && (
        <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md bg-sky-pale border border-sky-soft/50 text-[12px] text-sky">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-sky border-t-transparent animate-spin" aria-hidden="true" />
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
                    <Button size="sm" className="!rounded-full !bg-phase-build !text-white hover:!bg-phase-build/80" onClick={() => acceptTrade(offer.id)}>
                      Accept {offer.claimer}
                    </Button>
                  )}
                  <Button size="sm" className="!rounded-full !bg-canvas-raised !border !border-clay-soft !text-clay hover:!bg-clay-pale" onClick={() => declineTrade(offer.id)}>
                    Decline
                  </Button>
                </>
              )}
              <Button size="sm" className="!rounded-full" onClick={() => cancelTrade(offer.id)}>
                Cancel
              </Button>
            </>
          ) : isOpen && !offer.claimer ? (
            // Open offer I haven't taken: take it.
            canTake && (
              <Button size="sm" className="!rounded-full !bg-sky !text-white hover:!bg-sky-soft" onClick={() => takeTrade(offer.id)}>
                Take offer
              </Button>
            )
          ) : iAmClaimer ? (
            // I took an open offer; withdraw my claim.
            <Button size="sm" className="!rounded-full" onClick={() => declineTrade(offer.id)}>
              Withdraw
            </Button>
          ) : iAmRecipient ? (
            // Directed offer to me.
            <>
              <Button size="sm" className="!rounded-full !bg-canvas-raised !border !border-clay-soft !text-clay hover:!bg-clay-pale" onClick={() => declineTrade(offer.id)}>
                Decline
              </Button>
              {canAccept && (
                <Button size="sm" className="!rounded-full !bg-phase-build !text-white hover:!bg-phase-build/80" onClick={() => acceptTrade(offer.id)}>
                  Accept
                </Button>
              )}
            </>
          ) : null}
        </div>
      )}

      {offer.status === 'pending' && blockedReason && (
        <p className="text-[12px] text-clay mt-1.5 m-0"><GameIcon name="lock" size={11} className="inline -mt-0.5" /> {blockedReason}</p>
      )}

      {offer.status !== 'pending' && (
        <p className="text-[12px] text-ink-soft mt-1.5 m-0 capitalize">Status: {offer.status}</p>
      )}
    </div>
  );
};

/** A trade action button: always visible, greyed out when unavailable;
 *  clicking a greyed one reports the reason. */
const TradeButton: React.FC<{
  label: React.ReactNode;
  check: BuildCheck;
  /** Enabled state colors as a Button variant: build for a profitable bank
   *  trade, sky for posting a player offer. */
  variant: 'build' | 'sky';
  onDo: () => void;
  onBlocked: (reason: string) => void;
}> = ({ label, check, variant, onDo, onBlocked }) => (
  <Button
    variant="unstyled"
    onClick={() => (check.allowed ? onDo() : onBlocked(check.reason ?? 'Not allowed'))}
    aria-disabled={!check.allowed}
    className={`w-full py-2 text-[14px] font-bold rounded-lg border-2 text-white shadow-card ${
      check.allowed
        ? variant === 'build'
          ? 'bg-phase-build border-phase-build hover:bg-phase-build/80 cursor-pointer'
          : 'bg-sky border-sky hover:bg-sky-soft cursor-pointer'
        : 'bg-ink-faint/50 border-ink-faint/50 cursor-not-allowed'
    }`}
  >
    {label}
  </Button>
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
  const { gameRoom, currentPlayer } = useGameState();
  const { createTradeOffer, bankTrade } = useSocket();
  const { playerByName, colorOf } = usePlayers();
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
  const turnOwnerColor = colorOf(turnOwner);
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
    bankTrade(bankGive, bankWant, bankCount);
    setBankCount(bankRatio);
  };
  const submitOffer = () => {
    if (!offerCheck.allowed || !counterparty || isBank) return;
    // 'Anyone' posts an open offer (to === null) any player can take.
    createTradeOffer(isOpenTarget ? null : counterparty, give, want);
    setGive({ ...emptyPrice });
    setWant({ ...emptyPrice });
  };

  const targets: { value: string; label: string; icon?: IconName; color?: string; sub?: React.ReactNode }[] = [
    { value: 'Bank', label: 'Bank', icon: 'bank' },
    { value: 'Anyone', label: 'Anyone', icon: 'megaphone' },
    ...others.map((p) => ({ value: p.name, label: p.name, color: p.color, sub: <>{p.resourceCount} <GameIcon name="cards" size={11} className="inline" /></> })),
  ];

  // Offers, grouped and ordered by what they need from me.
  const decorateIncoming = (o: TradeOffer) => {
    const from = playerByName(o.from);
    // Counterparty: the directed recipient, or the player who took an open offer.
    const cpName = o.to ?? o.claimer ?? null;
    const counter = playerByName(cpName);
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
        <div className="flex items-center gap-2 text-[13px] rounded-lg px-3 py-2 bg-phase-build text-white shadow-card">
          <GameIcon name="trade" size={14} />
          <span>
            <strong>Your turn</strong> — trade with the bank or any player.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] rounded-lg px-3 py-2 border border-gold bg-gold-pale text-gold-deep">
          <Dot color={turnOwnerColor} size={12} />
          <span>
            Only <strong>{turnOwner}</strong> can start trades right now. You can still answer their offers below.
          </span>
        </div>
      )}

      {isTurnOwner && (
        <section>
          <SectionTitle>Trade with</SectionTitle>
          <OptionGrid
            layout="chip"
            selected={counterparty}
            options={targets.map((t) => ({
              key: t.value,
              title: t.label,
              icon: t.icon ? t.icon : <Dot color={t.color} size={12} />,
              sub: t.sub,
            }))}
            onPick={(value) => {
              setCounterparty(value);
              setNotice(null);
            }}
          />
        </section>
      )}

      {isTurnOwner && isBank && (
        <section className="rounded-xl border border-ink-faint/40 bg-canvas-sunken p-3 flex flex-col gap-3">
          <div>
            <SectionTitle>You give</SectionTitle>
            <ResourceTiles
              accent="sky"
              iconSize={24}
              gridClassName="grid grid-cols-5 gap-1.5"
              picked={bankGive}
              onPick={pickBankGive}
              sub={(k) => `have ${currentPlayer.resources[k]}`}
              badge={(k) => (
                <span
                  className={`text-[10px] font-bold px-1.5 rounded-full ${
                    ratioFor(k) < 4 ? 'bg-gold-pale text-gold-deep' : 'bg-canvas-sunken text-ink-soft'
                  }`}
                >
                  {ratioFor(k)}:1
                </span>
              )}
            />
          </div>
          <div>
            <SectionTitle>You get</SectionTitle>
            <ResourceTiles
              accent="sky"
              iconSize={24}
              gridClassName="grid grid-cols-5 gap-1.5"
              picked={bankWant}
              onPick={pickBankWant}
              sub={(k) => `bank ${gameRoom.bankSupply[k]}`}
            />
          </div>
          {/* Amount: whole batches of the ratio. */}
          <div className="flex items-center justify-center">
            <Stepper
              size="sm"
              value={bankCount}
              canDecrement={bankCount > bankRatio}
              canIncrement={bankCount / bankRatio < bankMaxBatches}
              onDecrement={() => setBankCount((c) => Math.max(bankRatio, c - bankRatio))}
              onIncrement={() => setBankCount((c) => c + bankRatio)}
              ariaDecrement="Fewer"
              ariaIncrement="More"
            >
              <span className="flex items-center gap-2 text-[16px] font-bold">
                <span className="text-clay">
                  {bankCount} <GameIcon name={RESOURCE_ICONS[bankGive]} size={16} className="inline -mt-0.5" />
                </span>
                <GameIcon name="arrowRight" size={14} className="text-ink-faint" />
                <span className="text-phase-build">
                  {bankGet} <GameIcon name={RESOURCE_ICONS[bankWant]} size={16} className="inline -mt-0.5" />
                </span>
              </span>
            </Stepper>
          </div>
          <TradeButton
            label="Trade with Bank"
            check={bankCheck}
            variant="build"
            onDo={submitBank}
            onBlocked={setNotice}
          />
          {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
        </section>
      )}

      {isTurnOwner && counterparty !== '' && !isBank && (
        <section className="rounded-xl border border-ink-faint/40 bg-canvas-sunken p-3 flex flex-col gap-3">
          <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] items-center gap-x-1.5 gap-y-1.5">
            <span />
            {RESOURCES.map((k) => (
              <span key={k} className="text-center text-xl leading-none" title={k}>
                <GameIcon name={RESOURCE_ICONS[k]} size={22} />
              </span>
            ))}
            <span className="text-[12px] font-bold text-clay pr-1">You give</span>
            {RESOURCES.map((k) => (
              <Counter key={k} tone="give" value={give[k]} max={currentPlayer.resources[k]} onChange={(v) => setGiveAmount(k, v)} />
            ))}
            <span className="text-[12px] font-bold text-phase-build pr-1">You get</span>
            {RESOURCES.map((k) => (
              <Counter key={k} tone="get" value={want[k]} onChange={(v) => setWantAmount(k, v)} />
            ))}
            <span className="text-[11px] text-ink-faint pr-1">You have</span>
            {RESOURCES.map((k) => (
              <span key={k} className="text-center text-[11px] text-ink-faint">
                {currentPlayer.resources[k]}
              </span>
            ))}
          </div>
          <TradeButton
            label={isOpenTarget ? 'Post to everyone' : `Send offer to ${counterparty}`}
            check={offerCheck}
            variant="sky"
            onDo={submitOffer}
            onBlocked={setNotice}
          />
          {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
        </section>
      )}

      {/* Offers, grouped by what they need from you; empty groups are hidden. */}
      {incoming.length > 0 && (
        <section>
          <SectionTitle count={incoming.length} accent="bg-clay">
            Needs your answer
          </SectionTitle>
          {incoming.map(decorateIncoming)}
        </section>
      )}
      {openOffers.length > 0 && (
        <section>
          <SectionTitle count={openOffers.length} accent="bg-sky">
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
      {!hasOffers && <p className="text-[12px] text-ink-faint text-center m-0">No trade offers right now.</p>}
    </div>
  );
};

export default TradeTab;
