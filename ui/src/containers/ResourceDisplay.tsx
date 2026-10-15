import React, { useState } from 'react';
import { BuildCheck, Player, canAfford, DevelopmentCardPrice, DEVELOPMENT_CARD_META, RESOURCES } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { DEV_CARD_ICONS, RESOURCE_ICONS } from '../utils/resourceIcons';
import GameIcon from '../components/ui/GameIcon';
import { PriceText, priceLabel } from '../utils/price';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * The current player's hand, rendered as a card tray centered on the bottom
 * edge: resource cards fanned on the left, dev cards on the right, and a
 * dashed Buy tile at the end. The action bubbles orbit the selected board
 * point instead of bottom-center, so this strip never collides with them.
 *
 * Phones start collapsed to a pull-tab so the board keeps the height; the
 * tab reopens the tray. Desktop keeps the tray open.
 */
const ResourceDisplay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { drawDevelopmentCard, playDevelopmentCard } = useSocket();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );
  // Which dev card is selected (shows its Play chip). Cleared when the hand
  // changes so a stale chip can't fire on a shifted card index.
  const [selCard, setSelCard] = useState<number | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);

  const me: Player | null = currentPlayer;
  const isMyTurn = !!me && !!gameRoom && gameRoom.turnState.player === me.name;

  // Mirror the server's purchase rules. An empty deck is reshuffled
  // server-side, so it never blocks a purchase.
  const buyCheck: BuildCheck = !isMyTurn
    ? { allowed: false, reason: 'You can only buy development cards on your turn' }
    : gameRoom.turnState.phase !== 'Build'
      ? { allowed: false, reason: 'You can only buy development cards during the Build phase' }
      : !canAfford(me.resources, DevelopmentCardPrice)
        ? { allowed: false, reason: `Need ${priceLabel(DevelopmentCardPrice)}` }
        : { allowed: true, reason: null };

  if (!gameRoom || !me) return null;

  const handleDrawDevCard = () => drawDevelopmentCard(gameRoom.id);
  const handlePlayDevCard = (cardIndex: number) => {
    playDevelopmentCard(gameRoom.id, cardIndex);
    setSelCard(null);
  };

  return (
    <div
      data-resource-section="true"
      className={`fixed left-1/2 -translate-x-1/2 bottom-0 z-20 transition-transform duration-200 ${
        collapsed ? 'translate-y-full' : ''
      }`}
    >
      {/* Pull tab: phones start collapsed so the board keeps the height. */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Show your hand' : 'Hide your hand'}
        title={collapsed ? 'Show your hand' : 'Hide your hand'}
        className="absolute bottom-full left-1/2 -translate-x-1/2 flex items-center justify-center w-16 h-7 rounded-t-lg bg-canvas-raised border border-b-0 border-ink-faint/40 text-ink-faint shadow-card cursor-pointer hover:text-ink"
      >
        {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Wood tray: warm brown base + horizontal grain + knots. */}
      <div
        className="relative flex items-end gap-4 px-4 pt-2.5 pb-2 rounded-t-2xl"
        style={{
          background:
            'radial-gradient(ellipse 10px 26px at 22% 40%, rgba(70,40,15,.4), transparent 60%),' +
            'radial-gradient(ellipse 8px 20px at 74% 60%, rgba(70,40,15,.3), transparent 60%),' +
            'repeating-linear-gradient(to bottom, rgba(0,0,0,.10) 0 1px, transparent 1px 9px),' +
            'linear-gradient(to bottom, #a9713e, #8f5c2d)',
          boxShadow: 'var(--tw-shadow, 0 4px 12px rgba(45,37,32,.12)), inset 0 2px 0 rgba(255,255,255,.15)',
        }}
      >
        {/* Resource cards, fanned like a physical hand. */}
        <div className="flex items-end" data-resource-cards="true">
          {RESOURCES.map((resource, i) => {
            const count = me.resources[resource] ?? 0;
            const tilt = i % 2 === 0 ? '-4deg' : '4deg';
            return (
              <div
                key={resource}
                className="flex flex-col items-center justify-center w-[52px] h-[74px] rounded-lg border-2 border-ink-faint/45 bg-white shadow-card -ml-3.5 first:ml-0 transition-transform"
                style={{ transform: `rotate(${tilt})`, transformOrigin: 'bottom center' }}
                title={`${resource}: ${count}`}
              >
                <span className="text-ink leading-none">
                  <GameIcon name={RESOURCE_ICONS[resource]} size={24} />
                </span>
                <span className="mt-1 px-1.5 py-px rounded-md bg-ink text-white text-[11px] font-extrabold leading-tight">
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        <div className="self-stretch w-px my-1 bg-white/20" />

        {/* Dev cards: tap a playable card to reveal its Play chip. */}
        <div className="flex items-end gap-1.5">
          {me.developmentCards.length === 0 && (
            <div className="w-[48px] h-[68px] flex items-center justify-center rounded-lg border-2 border-dashed border-white/40 text-[11px] text-white/70 text-center px-1">
              No dev cards
            </div>
          )}
          {me.developmentCards.map((card, i) => {
            const meta = DEVELOPMENT_CARD_META[card];
            // A card bought this turn can't be played until next turn: the
            // last `devCardsBoughtThisTurn` cards in the hand are the ones
            // just bought.
            const lockedThisTurn = i >= me.developmentCards.length - me.devCardsBoughtThisTurn;
            const playable = isMyTurn && !lockedThisTurn;
            // First click selects the card (lifts it + shows the Play chip);
            // the second click on the Play chip (or the card again) plays it.
            const selected = selCard === i;
            return (
              <button
                key={`${card}-${i}`}
                type="button"
                disabled={!playable}
                onClick={() => {
                  if (selected) {
                    handlePlayDevCard(i);
                    return;
                  }
                  setSelCard(i);
                }}
                title={`${meta.label}${lockedThisTurn ? ' — playable next turn' : playable ? ' — tap to select, tap again to play' : ''}`}
                className={`relative flex flex-col items-center justify-center w-12 h-[68px] rounded-lg border-2 shadow-card transition-transform ${
                  selected ? '-translate-y-2 ring-2 ring-purple-400' : ''
                } ${lockedThisTurn ? 'opacity-50' : 'cursor-pointer hover:-translate-y-1.5'} bg-purple-50 border-purple-300`}
              >
                {selected && playable && (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-extrabold whitespace-nowrap pointer-events-none">
                    Play
                  </span>
                )}
                <GameIcon name={DEV_CARD_ICONS[card]} size={22} />
                <span className="mt-0.5 text-[8px] font-bold text-purple-700">{meta.label}</span>
              </button>
            );
          })}
          {/* Buy tile: first tap expands to the cost + confirm; second buys. */}
          <button
            type="button"
            onClick={() => {
              if (!buyOpen) {
                setBuyOpen(true);
                return;
              }
              setBuyOpen(false);
              if (buyCheck.allowed) handleDrawDevCard();
            }}
            disabled={buyOpen && !buyCheck.allowed}
            title={buyOpen ? (buyCheck.allowed ? `Buy for ${priceLabel(DevelopmentCardPrice)} — tap again` : buyCheck.reason ?? "Can't buy") : `Buy a development card (${priceLabel(DevelopmentCardPrice)})`}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 text-[11px] font-bold transition-all ${
              buyOpen ? 'w-auto px-2 h-[68px]' : 'w-12 h-[68px]'
            } ${
              buyOpen
                ? buyCheck.allowed
                  ? 'bg-gold border-gold-deep text-white border-solid'
                  : 'bg-white/80 border-ink-faint/50 border-dashed text-ink-soft cursor-default'
                : 'border-dashed border-white/60 text-white/85 cursor-pointer hover:bg-white/10'
            }`}
          >
            {buyOpen ? (
              buyCheck.allowed ? (
                <>
                  <span><PriceText price={DevelopmentCardPrice} size={12} /></span>
                  <span className="text-[9px] opacity-90">tap to buy</span>
                </>
              ) : (
                <span className="text-[10px] leading-tight text-center px-1 max-w-[140px]">
                  {buyCheck.reason ?? "Can't buy"}
                </span>
              )
            ) : (
              <>
                <span className="leading-none"><GameIcon name="cards" size={18} /></span>
                <span>Buy card</span>
              </>
            )}
          </button>
        </div>

        {/* Free roads from a played Road Building card — pinned above the tray's right edge. */}
        {me.freeRoadsLeft > 0 && (
          <div
            className="absolute bottom-full right-3 mb-1.5 px-2 py-0.5 rounded-md bg-canvas-raised text-[11px] font-extrabold text-moss shadow-card"
            title="Free roads from Road Building card"
          >
            <GameIcon name="road" size={12} className="inline -mt-0.5" /> {me.freeRoadsLeft} free road{me.freeRoadsLeft > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceDisplay;
