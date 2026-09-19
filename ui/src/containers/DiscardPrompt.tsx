import React, { useState, useEffect } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { RESOURCES, ResourceKey } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

/**
 * 7-discard prompt. Shown when a 7 is rolled and a player holds 8 or more
 * resource cards: that player must hand in half their hand (rounded down),
 * choosing which resource cards to discard.
 *  - The affected player gets a full-screen modal with +/- counters per
 *    resource (capped at their own hand) and a confirm button that enables
 *    only at the exact required count.
 *  - Other players see a "{names} must discard cards" notice.
 * Discards must all be resolved before the robber can be moved.
 */
const DiscardPrompt: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { resolveDiscard } = useSocket();
  const [counts, setCounts] = useState<Record<ResourceKey, number>>({
    Wood: 0,
    Brick: 0,
    Sheep: 0,
    Wheat: 0,
    Ore: 0,
  });

  // Reset the selection when the prompt closes, so a stale discard selection
  // from a previous 7 can't pre-enable the confirm.
  const active = !!gameRoom?.discards;
  useEffect(() => {
    if (!active) setCounts({ Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 });
  }, [active]);

  if (!gameRoom || !currentPlayer || !gameRoom.discards) return null;
  const pendingNames = Object.keys(gameRoom.discards);
  if (pendingNames.length === 0) return null;
  const required: number | undefined = gameRoom.discards[currentPlayer.name];

  // Other players see a notice that someone must discard.
  if (required === undefined) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 shadow-lg">
        <span className="text-[13px] font-semibold text-amber-800">
          {pendingNames.join(', ')} must discard cards
        </span>
      </div>
    );
  }

  const handTotal = RESOURCES.reduce((sum, r) => sum + currentPlayer.resources[r], 0);
  const total = RESOURCES.reduce((sum, r) => sum + (counts[r] ?? 0), 0);

  const increment = (r: ResourceKey) => {
    if (total >= required) return; // at capacity
    if ((counts[r] ?? 0) >= currentPlayer.resources[r]) return; // out of that resource
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) + 1 }));
  };
  const decrement = (r: ResourceKey) => {
    if ((counts[r] ?? 0) <= 0) return;
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) - 1 }));
  };

  const confirm = () => {
    if (total !== required) return;
    resolveDiscard(currentPlayer.id, counts, gameRoom.id);
    setCounts({ Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-[520px] max-w-full">
        <h2 className="text-lg font-bold text-gray-800 mb-1">A 7 was rolled</h2>
        <p className="text-sm text-gray-500 mb-3">
          You have {handTotal} resource cards. Discard {required} (half, rounded down) — choose
          which ones to lose.
        </p>

        {/* Resource buttons with +/- counters (capped by the player's hand). */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {RESOURCES.map((r) => {
            const count = counts[r] ?? 0;
            const held = currentPlayer.resources[r];
            return (
              <div
                key={r}
                className={`w-24 py-3 rounded-md border-2 flex flex-col items-center gap-1 ${
                  count > 0 ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
                }`}
              >
                <span className="text-3xl">{RESOURCE_ICONS[r]}</span>
                <span className="text-sm font-semibold text-gray-700">
                  {r} ({held})
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => decrement(r)}
                    disabled={count <= 0}
                    className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm font-bold text-gray-800">{count}</span>
                  <button
                    type="button"
                    onClick={() => increment(r)}
                    disabled={total >= required || count >= held}
                    className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={confirm}
          disabled={total !== required}
          className={`w-full py-2 rounded-md font-semibold transition-colors cursor-pointer ${
            total === required
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Discard {total}/{required} cards
        </button>
      </div>
    </div>
  );
};

export default DiscardPrompt;
