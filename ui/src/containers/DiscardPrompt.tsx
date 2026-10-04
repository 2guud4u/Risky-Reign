import React, { useState, useEffect } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { backdropClass, modalCardClass } from '../styles';
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
  const active = Object.keys(gameRoom?.discards ?? {}).length > 0;
  useEffect(() => {
    if (!active) setCounts({ Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 });
  }, [active]);

  if (!gameRoom || !currentPlayer || !gameRoom.discards) return null;
  const pendingNames = Object.keys(gameRoom.discards);
  if (pendingNames.length === 0) return null;
  const required: number | undefined = gameRoom.discards[currentPlayer.name];

  // Other players see the "must discard" notice in the shared NoticeRail.
  if (required === undefined) return null;

  const handTotal = RESOURCES.reduce((sum, r) => sum + currentPlayer.resources[r], 0);
  const total = RESOURCES.reduce((sum, r) => sum + (counts[r] ?? 0), 0);

  const increment = (r: ResourceKey, by = 1) => {
    // Capped by what's still owed and by how many of `r` the player holds.
    const room = Math.min(required - total, currentPlayer.resources[r] - (counts[r] ?? 0), by);
    if (room <= 0) return;
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) + room }));
  };
  const decrement = (r: ResourceKey) => {
    if ((counts[r] ?? 0) <= 0) return;
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) - 1 }));
  };

  const confirm = () => {
    if (total !== required) return;
    resolveDiscard(counts, gameRoom.id);
    setCounts({ Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 });
  };

  return (
    <div className={backdropClass}>
      <div className={`${modalCardClass} max-w-[560px]`}>
        <h2 className="text-lg font-bold text-gray-800 mb-1">A 7 was rolled</h2>
        <p className="text-sm text-gray-500 mb-3">
          You hold {handTotal} cards — discard {required} of them.
        </p>

        {/* One tile per resource: − / count / + and "Max" (capped by the hand). */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {RESOURCES.map((r) => {
            const count = counts[r] ?? 0;
            const held = currentPlayer.resources[r];
            const canAdd = total < required && count < held;
            return (
              <div
                key={r}
                className={`py-2 rounded-md border-2 flex flex-col items-center gap-1 ${
                  count > 0 ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
                }`}
              >
                <span className="text-3xl">{RESOURCE_ICONS[r]}</span>
                <span className="text-[12px] font-semibold text-gray-700">
                  {r} ({held})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => decrement(r)}
                    disabled={count <= 0}
                    aria-label={`Discard one less ${r}`}
                    className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-gray-800">{count}</span>
                  <button
                    type="button"
                    onClick={() => increment(r)}
                    disabled={!canAdd}
                    aria-label={`Discard one more ${r}`}
                    className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => increment(r, held)}
                  disabled={!canAdd}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                >
                  Max
                </button>
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
