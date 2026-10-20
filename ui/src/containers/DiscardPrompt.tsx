import React, { useState } from 'react';
import { useGameState } from '../contexts/GameContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import ResourceTiles from '../components/ui/ResourceTiles';
import { useSocket } from '../contexts/SocketContext';
import { RESOURCES, ResourceKey } from 'common';
import { useResetOn } from '../hooks/useResetOn';

const EMPTY: Record<ResourceKey, number> = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };
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
  const { gameRoom, currentPlayer } = useGameState();
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
  useResetOn(active, () => setCounts({ ...EMPTY }));

  // Outer stays mounted: Modal wraps AnimatePresence, which must exist
  // for the exit spring to play. Values below fall back when nothing is owed.
  const discards = gameRoom?.discards;
  const required = currentPlayer && discards ? discards[currentPlayer.name] : undefined;
  const open = required !== undefined;

  const handTotal = RESOURCES.reduce((sum, r) => sum + (currentPlayer?.resources[r] ?? 0), 0);
  const total = RESOURCES.reduce((sum, r) => sum + (counts[r] ?? 0), 0);
  const need = required ?? 0;

  const increment = (r: ResourceKey, by = 1) => {
    if (!currentPlayer) return;
    // Capped by what's still owed and by how many of `r` the player holds.
    const room = Math.min(need - total, currentPlayer.resources[r] - (counts[r] ?? 0), by);
    if (room <= 0) return;
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) + room }));
  };
  const decrement = (r: ResourceKey) => {
    if ((counts[r] ?? 0) <= 0) return;
    setCounts((prev) => ({ ...prev, [r]: (prev[r] ?? 0) - 1 }));
  };

  const confirm = () => {
    if (total !== need || !gameRoom) return;
    resolveDiscard(counts);
    setCounts({ ...EMPTY });
  };

  return (
    <Modal open={open} aria-label="Discard cards" title="A 7 was rolled" width="max-w-[560px]">
      <p className="text-sm text-ink-soft mb-3">
        You hold {handTotal} cards — discard {need} of them.
      </p>
      {/* One tile per resource: − / count / + and "Max" (capped by the hand). */}
      <div className="mb-4">
        <ResourceTiles
          counts={counts}
          accent="clay"
          sub={(r) => `held ${currentPlayer?.resources[r] ?? 0}`}
          onStep={(r, d) => (d > 0 ? increment(r, d) : decrement(r))}
          canAdd={(r) => total < need && (counts[r] ?? 0) < (currentPlayer?.resources[r] ?? 0)}
          maxFor={(r) => currentPlayer?.resources[r] ?? null}
        />
      </div>

      <Button
        variant="danger"
        onClick={confirm}
        disabled={total !== need}
        className="w-full"
      >
        Discard {total}/{need} cards
      </Button>
    </Modal>
  );
};

export default DiscardPrompt;
