import React from 'react';
import { Player, canAfford, DevelopmentCardPrice, DEVELOPMENT_CARD_META } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

/**
 * The current player's resource cards and development cards, shown as a single
 * vertical column overlaid on the right-middle of the board. Includes the face-up
 * development cards (with Play), a "+" button to buy a development card, and any
 * free roads. `data-resource-section` marks the landing point for the flying
 * resource-gain icons.
 */
const ResourceDisplay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { drawDevelopmentCard, playDevelopmentCard } = useSocket();
  if (!gameRoom || !currentPlayer) return null;

  const me: Player = currentPlayer;
  const isMyTurn = gameRoom.turnState.player === me.name;

  // Buying is only allowed on your own turn (enforced server-side too).
  const canBuyDevCard =
    isMyTurn && canAfford(me.resources, DevelopmentCardPrice) && gameRoom.devCardDeck.length > 0;

  const handleDrawDevCard = () => drawDevelopmentCard(me.id, gameRoom.id);
  const handlePlayDevCard = (cardIndex: number) => playDevelopmentCard(me.id, gameRoom.id, cardIndex);

  return (
    <div
      data-resource-section="true"
      className="flex flex-col gap-1.5 bg-white/85 backdrop-blur-sm rounded-lg shadow p-2"
    >
      <div className="text-[12px] font-semibold text-gray-600 text-center">Your Resources</div>
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

      {/* Free roads from a played Road Building card. */}
      {me.freeRoadsLeft > 0 && (
        <div className="text-[11px] text-green-700 font-semibold text-center" title="Free roads from Road Building card">
          🛤️ {me.freeRoadsLeft} free road{me.freeRoadsLeft > 1 ? 's' : ''}
        </div>
      )}

      {/* Development cards (face-up) with Play. */}
      <div className="text-[12px] font-semibold text-gray-600 text-center mt-1">
        Dev Cards ({me.developmentCards.length})
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

      {/* Buy a development card ("+" button, under the dev-card UI). */}
      {canBuyDevCard && (
        <button
          type="button"
          onClick={handleDrawDevCard}
          className="mt-1 self-center w-7 h-7 flex items-center justify-center text-[18px] leading-none font-bold rounded-full border border-purple-700 bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
          title={`Buy a development card (🌾1 🧱1 ⛏️1). ${gameRoom.devCardDeck.length} cards left in deck.`}
        >
          +
        </button>
      )}
    </div>
  );
};

export default ResourceDisplay;
