import React, { useState, useEffect } from 'react';
import { useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Modal from '../components/ui/Modal';
import { RESOURCES, ResourceKey } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import GameIcon from '../components/ui/GameIcon';

/**
 * Development-card choice prompt. Shown when the current player plays a
 * Knight, Year of Plenty or Monopoly card. The player chooses:
 *  - Knight: move the robber (no steal), or spawn a soldier (then picks a vertex with
 *    one of their soldiers on the map — no modal while placing);
 *  - Year of Plenty: 2 resources to take from the bank (may be 2 of the
 *    same type);
 *  - Monopoly: 1 resource type to name (all other players give their
 *    cards of that type).
 * Other players see a "{player} is choosing a card" notice.
 */
const DevCardPrompt: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const { resolveDevCardChoice, chooseKnightEffect } = useSocket();
  const [counts, setCounts] = useState<Record<ResourceKey, number>>({
    Wood: 0,
    Brick: 0,
    Sheep: 0,
    Wheat: 0,
    Ore: 0,
  });

  // Reset the selection when the prompt closes, so a stale pick from a
  // previous prompt (a second Year of Plenty, a reset, or a choice resolved
  // elsewhere) can't pre-enable the confirm or carry an invalid selection.
  const active = !!gameRoom?.devCardChoice;
  useEffect(() => {
    if (!active) setCounts({ Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 });
  }, [active]);

  // Outer stays mounted: Modal wraps AnimatePresence, which must exist
  // for the exit spring to play. The knight "spawn" path intentionally stays
  // closed — placement happens on the map (NoticeRail hint).
  const choice = gameRoom?.devCardChoice;
  const card = choice?.card ?? 'monopoly';
  const mine = !!gameRoom && !!currentPlayer && !!choice && choice.player === currentPlayer.name;
  const knightOpen = mine && card === 'knight' && !choice?.spawn;
  const resourceOpen = mine && (card === 'year_of_plenty' || card === 'monopoly');
  const isYearOfPlenty = card === 'year_of_plenty';
  if (card === 'knight') {
    const options = [
      { effect: 'robber', icon: 'robber', title: 'Move robber', sub: 'and steal a card' },
      { effect: 'spawn', icon: 'knight', title: 'Spawn soldier', sub: 'where you have one' },
    ] as const;
    return (
      <Modal open={knightOpen} aria-label="Knight card" title="Knight" width="max-w-[420px]">
        <div className="flex gap-3">
          {options.map((o) => (
            <button
              key={o.effect}
              type="button"
              onClick={() => chooseKnightEffect(o.effect)}
              className="flex-1 py-4 rounded-md border-2 border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50 active:scale-95 motion-reduce:active:scale-100 transition-all flex flex-col items-center gap-1 cursor-pointer"
            >
              <GameIcon name={o.icon} size={32} />
              <span className="text-sm font-semibold text-gray-800">{o.title}</span>
              <span className="text-[11px] text-gray-500">{o.sub}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => chooseKnightEffect('cancel')}
          className="mt-3 w-full py-1.5 rounded-md text-[13px] font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer"
        >
          Keep the card for later
        </button>
      </Modal>
    );
  }

  const total = RESOURCES.reduce((sum, r) => sum + (counts[r] ?? 0), 0);

  const increment = (r: ResourceKey) => {
    if (total >= 2) return; // at capacity
    // Year of Plenty takes from the bank: cannot exceed the bank's supply.
    if (isYearOfPlenty && (counts[r] ?? 0) >= (gameRoom?.bankSupply?.[r] ?? Infinity)) return;
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) + 1 }));
  };
  const decrement = (r: ResourceKey) => {
    if ((counts[r] ?? 0) <= 0) return;
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) - 1 }));
  };

  const confirm = () => {
    if (total !== 2 || !gameRoom) return;
    // Expand the counts into a 2-element list (e.g. {Wood:2} -> ['Wood','Wood']).
    const resources: string[] = [];
    for (const r of RESOURCES) {
      for (let i = 0; i < (counts[r] ?? 0); i++) resources.push(r);
    }
    resolveDevCardChoice(resources);
    setCounts({ Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 });
  };

  return (
    <Modal open={resourceOpen} aria-label="Development card choice" title={isYearOfPlenty ? 'Year of Plenty' : 'Monopoly'} width="max-w-[560px]">
      <p className="text-sm text-gray-500 mb-3">
        {isYearOfPlenty
          ? 'Take any 2 cards from the bank (2 of the same is fine).'
          : 'Pick a resource — every other player hands you all of theirs.'}
      </p>

      {/* One tile per resource: +/- counters (Year of Plenty), or the whole
          tile is the pick (Monopoly). */}
      <div className="grid grid-cols-3 min-[480px]:grid-cols-5 gap-2 mb-4">
        {RESOURCES.map((r) => {
          const count = counts[r] ?? 0;
          const face = (
            <>
              <GameIcon name={RESOURCE_ICONS[r]} size={30} />
              <span className="text-[12px] font-semibold text-gray-700">{r}</span>
              <span className="text-[11px] text-gray-400">you have {currentPlayer?.resources[r] ?? 0}</span>
            </>
          );
          if (!isYearOfPlenty) {
            return (
              <button
                key={r}
                type="button"
                onClick={() => resolveDevCardChoice([r])}
                className="py-2 rounded-md border-2 border-gray-300 bg-white flex flex-col items-center gap-1 cursor-pointer hover:border-blue-500 hover:bg-blue-50 active:scale-95 motion-reduce:active:scale-100 transition-all"
              >
                {face}
              </button>
            );
          }
          return (
            <div
              key={r}
              className={`py-2 rounded-md border-2 flex flex-col items-center gap-1 ${
                count > 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
              }`}
            >
              {face}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => decrement(r)}
                  disabled={count <= 0}
                  aria-label={`Take one less ${r}`}
                  className="w-11 h-11 md:w-6 md:h-6 rounded bg-gray-200 hover:bg-gray-300 active:scale-90 motion-reduce:active:scale-100 transition-transform disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold cursor-pointer"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-bold text-gray-800">{count}</span>
                <button
                  type="button"
                  onClick={() => increment(r)}
                  disabled={total >= 2 || count >= (gameRoom?.bankSupply?.[r] ?? Infinity)}
                  aria-label={`Take one more ${r}`}
                  className="w-11 h-11 md:w-6 md:h-6 rounded bg-gray-200 hover:bg-gray-300 active:scale-90 motion-reduce:active:scale-100 transition-transform disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm button (Year of Plenty only; Monopoly resolves on pick). */}
      {isYearOfPlenty && (
        <button
          type="button"
          onClick={confirm}
          disabled={total !== 2}
          className={`w-full py-2 rounded-md font-semibold transition-all active:scale-[0.98] motion-reduce:active:scale-100 cursor-pointer ${
            total === 2
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Take {total}/2 cards
        </button>
      )}
    </Modal>
  );
};

export default DevCardPrompt;
