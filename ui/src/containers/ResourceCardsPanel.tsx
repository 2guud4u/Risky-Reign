import React from 'react';
import { canAfford, DEVELOPMENT_CARD_META, DevelopmentCardPrice, Player } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

/**
 * Personal hand panel: shows the current player's resources as individual
 * cards and their development cards (face-up). Includes buttons to buy and
 * play development cards.
 */
const ResourceCardsPanel: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { drawDevelopmentCard, playDevelopmentCard } = useSocket();

  if (!gameRoom || !currentPlayer) return null;

  const me: Player = currentPlayer;
  const isMyTurn = gameRoom.turnState.player === me.name;

  // Buying is only allowed on your own turn (enforced server-side too).
  const canBuyDevCard =
    isMyTurn &&
    canAfford(me.resources, DevelopmentCardPrice) &&
    gameRoom.devCardDeck.length > 0;

  const handleDrawDevCard = () => {
    drawDevelopmentCard(me.id, gameRoom.id);
  };

  const handlePlayDevCard = (cardIndex: number) => {
    playDevelopmentCard(me.id, gameRoom.id, cardIndex);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Resource cards: one card per resource type. */}
      <div>
        <div className="text-[12px] font-semibold text-gray-600 mb-1">
          Your Resources
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(me.resources).map(([resource, count]) => (
            <div
              key={resource}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 bg-white text-[13px] shadow-sm"
              title={`${resource}: ${count}`}
            >
              <span>{RESOURCE_ICONS[resource as keyof typeof RESOURCE_ICONS] ?? '❓'}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Victory points and free roads indicators. */}
      {(me.victoryPoints > 0 || me.freeRoadsLeft > 0) && (
        <div className="flex gap-2 text-[12px]">
          {me.victoryPoints > 0 && (
            <span className="text-yellow-700 font-semibold" title="Victory points earned">
              ⭐ {me.victoryPoints} VP
            </span>
          )}
          {me.freeRoadsLeft > 0 && (
            <span className="text-green-700 font-semibold" title="Free roads from Road Building card">
              🛤️ {me.freeRoadsLeft} free road{me.freeRoadsLeft > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Development cards held (face-up). */}
      <div>
        <div className="text-[12px] font-semibold text-gray-600 mb-1">
          Your Development Cards ({me.developmentCards.length})
        </div>
        {me.developmentCards.length === 0 ? (
          <div className="text-[12px] text-gray-400 italic">
            None yet — buy one below.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {me.developmentCards.map((card, i) => {
              const meta = DEVELOPMENT_CARD_META[card];
              return (
                <div
                  key={`${card}-${i}`}
                  className="flex items-center gap-2 p-2 rounded-md border border-purple-300 bg-purple-50 shadow-sm"
                  title={meta.description}
                >
                  <span className="text-xl">{meta.icon}</span>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-gray-800">{meta.label}</div>
                    <div className="text-[10px] text-gray-600 leading-tight">{meta.description}</div>
                  </div>
                  {isMyTurn && (
                    <button
                      type="button"
                      onClick={() => handlePlayDevCard(i)}
                      className="px-2 py-1 text-[11px] font-semibold rounded bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
                    >
                      Play
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Buy a development card. */}
      <button
        type="button"
        onClick={handleDrawDevCard}
        disabled={!canBuyDevCard}
        className={`w-full px-3 py-2 text-sm text-center rounded-md border ${
          canBuyDevCard
            ? 'bg-purple-600 text-white cursor-pointer hover:bg-purple-700'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
        title={`Cost: 1 wheat, 1 brick, 1 ore. ${gameRoom.devCardDeck.length} cards left in deck.`}
      >
        Buy Development Card (🌾1 🧱1 ⛏️1)
        <span className="block text-[10px] opacity-75">
          {gameRoom.devCardDeck.length} cards left in deck
        </span>
      </button>

      {!isMyTurn && (
        <div className="text-[11px] text-gray-400">
          You can buy and play development cards on your turn.
        </div>
      )}
    </div>
  );
};

export default ResourceCardsPanel;
