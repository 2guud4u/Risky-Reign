import React, { useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { RESOURCES, ResourceKey } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

/**
 * Development-card choice prompt. Shown when the current player plays a
 * Year of Plenty or Monopoly card. The player chooses:
 *  - Year of Plenty: 2 resources to take from the bank (may be 2 of the
 *    same type);
 *  - Monopoly: 1 resource type to name (all other players give their
 *    cards of that type).
 * Other players see a "{player} is choosing a card" notice.
 */
const DevCardPrompt: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { resolveDevCardChoice } = useSocket();
  const [counts, setCounts] = useState<Record<ResourceKey, number>>({
    Wood: 0,
    Brick: 0,
    Sheep: 0,
    Wheat: 0,
    Ore: 0,
  });

  if (!gameRoom || !currentPlayer || !gameRoom.devCardChoice) return null;
  const { player, card } = gameRoom.devCardChoice;
  const isYearOfPlenty = card === 'year_of_plenty';

  // Other players see a notice that the player is choosing.
  if (player !== currentPlayer.name) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 shadow-lg">
        <span className="text-[13px] font-semibold text-amber-800">
          {player} is choosing a card
        </span>
      </div>
    );
  }

  const total = RESOURCES.reduce((sum, r) => sum + (counts[r] ?? 0), 0);

  const increment = (r: ResourceKey) => {
    if (total >= 2) return; // at capacity
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) + 1 }));
  };
  const decrement = (r: ResourceKey) => {
    if ((counts[r] ?? 0) <= 0) return;
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) - 1 }));
  };

  const confirm = () => {
    if (total !== 2) return;
    // Expand the counts into a 2-element list (e.g. {Wood:2} -> ['Wood','Wood']).
    const resources: string[] = [];
    for (const r of RESOURCES) {
      for (let i = 0; i < (counts[r] ?? 0); i++) resources.push(r);
    }
    resolveDevCardChoice(currentPlayer.id, resources, gameRoom.id);
    setCounts({ Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-[520px] max-w-full">
        <h2 className="text-lg font-bold text-gray-800 mb-1">
          {isYearOfPlenty ? 'Year of Plenty' : 'Monopoly'}
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          {isYearOfPlenty
            ? 'Choose 2 resources to take from the bank (you may take 2 of the same type).'
            : 'Name a resource type. Every other player gives you their cards of that type.'}
        </p>

        {/* Resource buttons with +/- counters (Year of Plenty) or single-pick (Monopoly). */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {RESOURCES.map((r) => {
            const count = counts[r] ?? 0;
            return (
              <div
                key={r}
                className={`w-24 py-3 rounded-md border-2 flex flex-col items-center gap-1 ${
                  count > 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                }`}
              >
                <span className="text-3xl">{RESOURCE_ICONS[r]}</span>
                <span className="text-sm font-semibold text-gray-700">{r}</span>
                {isYearOfPlenty ? (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => decrement(r)}
                      disabled={count <= 0}
                      className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm font-bold text-gray-800">
                      {count}
                    </span>
                    <button
                      type="button"
                      onClick={() => increment(r)}
                      disabled={total >= 2}
                      className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => resolveDevCardChoice(currentPlayer.id, [r], gameRoom.id)}
                    className="mt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Name it
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm button (Year of Plenty only; Monopoly resolves on pick). */}
        {isYearOfPlenty ? (
          <button
            type="button"
            onClick={confirm}
            disabled={total !== 2}
            className={`w-full py-2 rounded-md font-semibold transition-colors cursor-pointer ${
              total === 2
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Take {total}/2 resources
          </button>
        ) : (
          <p className="text-xs text-gray-400 text-center">
            Click "Name it" on a resource to resolve the card.
          </p>
        )}
      </div>
    </div>
  );
};

export default DevCardPrompt;
