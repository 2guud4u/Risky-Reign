import React, { useState } from 'react';
import { useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import OptionGrid from '../components/ui/OptionGrid';
import ResourceTiles from '../components/ui/ResourceTiles';
import { RESOURCES, ResourceKey } from 'common';
import { useResetOn } from '../hooks/useResetOn';

const EMPTY: Record<ResourceKey, number> = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };

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
  const [counts, setCounts] = useState<Record<ResourceKey, number>>({ ...EMPTY });

  // Reset the selection when the prompt closes, so a stale pick from a
  // previous prompt (a second Year of Plenty, a reset, or a choice resolved
  // elsewhere) can't pre-enable the confirm or carry an invalid selection.
  const active = !!gameRoom?.devCardChoice;
  useResetOn(active, () => setCounts({ ...EMPTY }));

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
      { effect: 'robber', icon: 'robber', title: 'Move robber', sub: 'no steal' },
      { effect: 'spawn', icon: 'knight', title: 'Spawn soldier', sub: 'where you have one' },
    ] as const;
    return (
      <Modal open={knightOpen} aria-label="Knight card" title="Knight" width="max-w-[420px]">
        <OptionGrid
          layout="card"
          options={options.map((o) => ({ key: o.effect, icon: o.icon, title: o.title, sub: o.sub }))}
          onPick={(effect) => chooseKnightEffect(effect)}
        />
        <Button variant="ghost" onClick={() => chooseKnightEffect('cancel')} className="mt-3 w-full">
          Keep the card for later
        </Button>
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
    setCounts({ ...EMPTY });
  };

  return (
    <Modal open={resourceOpen} aria-label="Development card choice" title={isYearOfPlenty ? 'Year of Plenty' : 'Monopoly'} width="max-w-[560px]">
      <p className="text-sm text-ink-soft mb-3">
        {isYearOfPlenty
          ? 'Take any 2 cards from the bank (2 of the same is fine).'
          : 'Pick a resource — every other player hands you all of theirs.'}
      </p>

      {/* One tile per resource: +/- counters (Year of Plenty), or the whole
          tile is the pick (Monopoly). */}
      <div className="mb-4">
        {isYearOfPlenty ? (
          <ResourceTiles
            counts={counts}
            accent="sky"
            sub={(r) => `you have ${currentPlayer?.resources[r] ?? 0}`}
            onStep={(r, d) => (d > 0 ? increment(r) : decrement(r))}
            canAdd={(r) => total < 2 && (counts[r] ?? 0) < (gameRoom?.bankSupply?.[r] ?? Infinity)}
          />
        ) : (
          <ResourceTiles
            accent="sky"
            sub={(r) => `you have ${currentPlayer?.resources[r] ?? 0}`}
            onPick={(r) => resolveDevCardChoice([r])}
          />
        )}
      </div>

      {/* Confirm button (Year of Plenty only; Monopoly resolves on pick). */}
      {isYearOfPlenty && (
        <Button variant="primary" onClick={confirm} disabled={total !== 2} className="w-full">
          Take {total}/2 cards
        </Button>
      )}
    </Modal>
  );
};

export default DevCardPrompt;
