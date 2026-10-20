import React, { useState } from 'react';
import { useGameState, usePlayers } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import OptionGrid from '../components/ui/OptionGrid';
import { useResetOn } from '../hooks/useResetOn';

/**
 * Steal prompt. Shown after the robber is placed and there is at least one
 * eligible victim. The thief picks a face-down card from a victim:
 *  - other players see a "X is choosing a card to steal" notice;
 *  - the thief picks a victim, then one of their cards (rendered face-down,
 *    in the same fixed order the backend uses, so the card at index `i` is
 *    the same in both).
 * The cards are face-down ("?"): the victim's hand is masked server-side, so
 * only their public `resourceCount` is known — every card is equally likely.
 */
const StealPrompt: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const { chooseSteal } = useSocket();
  const [selectedVictim, setSelectedVictim] = useState<string | null>(null);

  // Reset the selection when the prompt closes, so a stale victim pick from a
  // previous steal can't point at a player who is no longer in the victims list.
  const { playerByName } = usePlayers();
  useResetOn(!!gameRoom?.steal, () => setSelectedVictim(null));

  // Outer stays mounted: Modal wraps AnimatePresence, which must exist
  // for the exit spring to play. The body only renders while the steal is live.
  const open =
    !!gameRoom && !!currentPlayer && !!gameRoom.steal && gameRoom.steal.thief === currentPlayer.name;
  const victims = gameRoom?.steal?.victims ?? [];
  const selectedPlayer = playerByName(selectedVictim);
  const cardCount = selectedPlayer?.resourceCount ?? 0;

  return (
    <Modal open={open} aria-label="Choose a card to steal" title="Choose a card to steal" width="max-w-[480px]">
      <p className="text-sm text-ink-soft mb-3">
        You rolled a 7. Pick a face-down card from one of these players.
      </p>

      {/* Victim chips (show each victim's total card count). */}
      <div className="mb-3">
        <OptionGrid
          layout="chip"
          selected={selectedVictim}
          options={victims.map((name) => ({
            key: name,
            title: name,
            sub: `${playerByName(name)?.resourceCount ?? 0} cards`,
          }))}
          onPick={setSelectedVictim}
        />
      </div>

      {/* Face-down cards for the selected victim. */}
      {selectedPlayer ? (
        <div>
          <p className="text-xs text-ink-faint mb-2">
            Take one of {selectedPlayer.name}&apos;s {cardCount} card
            {cardCount === 1 ? '' : 's'}:
          </p>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: cardCount }, (_, i) => (
              <Button
                key={i}
                variant="unstyled"
                onClick={() =>
                  chooseSteal(selectedPlayer.name, i)
                }
                className="w-12 h-16 rounded-md bg-gradient-to-br from-sky to-sky-soft text-white text-2xl font-bold shadow-card hover:scale-105 hover:shadow-pop active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 transition-transform"
                title="Take this card"
              >
                ?
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-faint">Select a player to see their cards.</p>
      )}
    </Modal>
  );
};

export default StealPrompt;
