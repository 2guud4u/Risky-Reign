import React, { useState, useEffect } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { backdropClass, modalCardClass } from '../styles';

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
  const { gameRoom, currentPlayer } = useGameRoom();
  const { chooseSteal } = useSocket();
  const [selectedVictim, setSelectedVictim] = useState<string | null>(null);

  // Reset the selection when the prompt closes, so a stale victim pick from a
  // previous steal can't point at a player who is no longer in the victims list.
  const active = !!gameRoom?.steal;
  useEffect(() => {
    if (!active) setSelectedVictim(null);
  }, [active]);

  if (!gameRoom || !currentPlayer || !gameRoom.steal) return null;
  const { thief, victims, reason } = gameRoom.steal;

  // Other players see the "choosing a card" notice in the shared NoticeRail.
  if (thief !== currentPlayer.name) return null;

  const selectedPlayer = gameRoom.players.find((p) => p.name === selectedVictim);
  const cardCount = selectedPlayer?.resourceCount ?? 0;

  return (
    <div className={backdropClass}>
      <div className={`${modalCardClass} max-w-[480px]`}>
        <h2 className="text-lg font-bold text-gray-800 mb-1">Choose a card to steal</h2>
        <p className="text-sm text-gray-500 mb-3">
          {reason === 'knight'
            ? 'You played a knight card.'
            : 'You rolled a 7.'}{' '}
          Pick a face-down card from one of these players.
        </p>

        {/* Victim buttons (show each victim's total card count). */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {victims.map((name) => {
            const player = gameRoom.players.find((p) => p.name === name);
            const count = player ? player.resourceCount : 0;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedVictim(name)}
                className={`px-3 py-1.5 rounded-md border text-sm font-semibold transition-colors ${
                  selectedVictim === name
                    ? 'bg-blue-100 border-blue-400 text-blue-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>

        {/* Face-down cards for the selected victim. */}
        {selectedPlayer ? (
          <div>
            <p className="text-xs text-gray-400 mb-2">
              Take one of {selectedPlayer.name}&apos;s {cardCount} card
              {cardCount === 1 ? '' : 's'}:
            </p>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: cardCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    chooseSteal(currentPlayer.id, selectedPlayer.name, i, gameRoom.id)
                  }
                  className="w-12 h-16 rounded-md bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center text-2xl font-bold shadow hover:scale-105 hover:shadow-lg transition-transform cursor-pointer"
                  title="Take this card"
                >
                  ?
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Select a player to see their cards.</p>
        )}
      </div>
    </div>
  );
};

export default StealPrompt;
