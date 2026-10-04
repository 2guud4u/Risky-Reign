import React, { useEffect, useState } from 'react';
import { BuildCheck, Player, canAfford, DevelopmentCardPrice, DEVELOPMENT_CARD_META } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import { priceLabel } from '../utils/price';
import { ActionBubble } from '../components/board/ActionBubbles';
import { RESOURCE_PANEL_TAB_SIZE_PX, RESOURCE_PANEL_LIP_HEIGHT_PX } from '../constants';

type PanelView = 'resources' | 'devCards';

/** Collapse-style chevron button that flips the panel between its two views. */
const ChevronButton: React.FC<{ direction: 'up' | 'down'; label: string; onClick: () => void }> = ({
  direction,
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="w-full flex items-center justify-center py-0.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200/70 cursor-pointer"
  >
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
      <polyline
        points={direction === 'up' ? '2,8 8,2 14,8' : '2,2 8,8 14,2'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

/**
 * Buy-a-dev-card bubble, styled and behaving like the map's action bubbles:
 * first click expands it (cost, or the reason it's blocked), second click on
 * the expanded bubble buys. It sits in a fixed bubble-sized slot and grows
 * leftward over the board so the panel itself never widens.
 */
const BuyDevCardBubble: React.FC<{ check: BuildCheck; onBuy: () => void }> = ({ check, onBuy }) => {
  const [open, setOpen] = useState(false);

  // If buying becomes allowed/blocked mid-expansion (turn/phase flips or the
  // hand changes), collapse so a stale confirm can't be clicked.
  useEffect(() => setOpen(false), [check.allowed]);

  return (
    <div className="relative self-center w-14 h-14 mt-1">
      <div className="absolute right-0 top-0 w-max">
        <ActionBubble
          action={{
            key: 'buyDevCard',
            icon: '🎴',
            label: 'Buy Dev Card',
            costText: priceLabel(DevelopmentCardPrice),
            check,
            run: onBuy,
          }}
          open={open}
          onClick={() => {
            if (!open) {
              setOpen(true);
              return;
            }
            setOpen(false);
            if (check.allowed) onBuy();
          }}
        />
      </div>
    </div>
  );
};

/**
 * The current player's hand, shown as a single vertical column overlaid on the
 * right-middle of the board. Two views: resource cards (a down chevron at the
 * bottom opens the dev cards) and development cards (an up chevron at the top
 * returns to resources), where face-up cards have Play plus a buy bubble. Free
 * roads stay visible in both views. `data-resource-section` marks the
 * landing point for the flying resource-gain icons, so it stays on the outer
 * container regardless of the active view.
 */
const ResourceDisplay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { drawDevelopmentCard, playDevelopmentCard } = useSocket();
  const [view, setView] = useState<PanelView>('resources');
  const [collapsed, setCollapsed] = useState(false);

const me: Player | null = currentPlayer;
const isMyTurn = !!me && !!gameRoom && gameRoom.turnState.player === me.name;
// Mirror the server's purchase rules. An empty deck is reshuffled server-side,
// so it never blocks a purchase.
const buyCheck: BuildCheck = !isMyTurn
   ? { allowed: false, reason: 'You can only buy development cards on your turn' }
   : gameRoom.turnState.phase !== 'Build'
     ? { allowed: false, reason: 'You can only buy development cards during the Build phase' }
     : !canAfford(me.resources, DevelopmentCardPrice)
       ? { allowed: false, reason: 'Need 1 wheat, 1 brick and 1 ore' }
       : { allowed: true, reason: null };

if (!gameRoom || !me) return null;

const handleDrawDevCard = () => drawDevelopmentCard(gameRoom.id);
const handlePlayDevCard = (cardIndex: number) => playDevelopmentCard(gameRoom.id, cardIndex);

   return (
     <div className="relative">
      <div
        data-resource-section="true"
        className={`flex items-stretch ${collapsed ? 'justify-center' : ''} bg-white/85 backdrop-blur-sm rounded-lg shadow pl-0 pr-2 pt-2 pb-2`}
      >
         {/* Collapse strip: replaces the panel's left padding; a slim bar on
          * the panel's left edge; click to hide (when collapsed the same bar
          * remains at the screen edge); click again to bring it back. */}
         <button
           type="button"
           onClick={() => setCollapsed(!collapsed)}
           aria-label={collapsed ? 'Show resources panel' : 'Hide resources panel'}
           title={collapsed ? 'Show resources panel' : 'Hide resources panel'}
           className="flex shrink-0 items-center justify-center rounded-l-lg cursor-pointer hover:bg-gray-100"
           style={{ width: RESOURCE_PANEL_TAB_SIZE_PX, minHeight: RESOURCE_PANEL_LIP_HEIGHT_PX }}
         >
           <svg width="6" height="6" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-gray-500">
             <polyline
               points={collapsed ? '9,3 5,7 9,11' : '5,3 9,7 5,11'}
               stroke="currentColor"
               strokeWidth="2"
               strokeLinecap="round"
               strokeLinejoin="round"
             />
           </svg>
         </button>
         {!collapsed && (
           <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {view === 'devCards' && (
              <ChevronButton direction="up" label="Show resources" onClick={() => setView('resources')} />
            )}

            {view === 'resources' && (
              <>
                <div className="text-[12px] font-semibold text-gray-600 text-center">Resources</div>
                {Object.entries(me.resources).map(([resource, count]) => (
                  <div
                    key={resource}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-300 bg-white text-[13px] shadow-sm"
                    title={`${resource}: ${count}`}
                  >
                    <span>{RESOURCE_ICONS[resource as keyof typeof RESOURCE_ICONS] ?? '❓'}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </>
            )}

            {/* Free roads from a played Road Building card. */}
            {me.freeRoadsLeft > 0 && (
              <div className="text-[11px] text-green-700 font-semibold text-center" title="Free roads from Road Building card">
                🛤️ {me.freeRoadsLeft} free road{me.freeRoadsLeft > 1 ? 's' : ''}
              </div>
            )}

            {view === 'devCards' && (
              <>
                {/* Development cards (face-up) with Play. */}
                <div className="text-[12px] font-semibold text-gray-600 text-center">
                  Dev Cards
                </div>
                {me.developmentCards.length === 0 ? (
                  <div className="text-[11px] text-gray-400 italic text-center">None yet</div>
                ) : (
                  me.developmentCards.map((card, i) => {
                    const meta = DEVELOPMENT_CARD_META[card];
                    // A card bought this turn can't be played until next turn: the last
                    // `devCardsBoughtThisTurn` cards in the hand are the ones just bought.
                    const lockedThisTurn = i >= me.developmentCards.length - me.devCardsBoughtThisTurn;
                    return (
                      <div
                        key={`${card}-${i}`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-purple-300 bg-purple-50 text-[12px]"
                        title={meta.description}
                      >
                        <span>{meta.icon}</span>
                        <span className="flex-1 truncate">{meta.label}</span>
                        {isMyTurn &&
                          (lockedThisTurn ? (
                            <span className="text-[10px] text-gray-500" title="A card bought this turn can only be played next turn">
                              Next turn
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePlayDevCard(i)}
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
                            >
                              Play
                            </button>
                          ))}
                      </div>
                    );
                  })
                )}

                {/* Buy a development card (two-step bubble, under the dev-card list). */}
                <BuyDevCardBubble check={buyCheck} onBuy={handleDrawDevCard} />
              </>
            )}

            {view === 'resources' && (
              <ChevronButton direction="down" label="Show development cards" onClick={() => setView('devCards')} />
            )}
          </div>
      )}
      </div>
    </div>
  );
};

export default ResourceDisplay;
