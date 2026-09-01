import React, { useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { expandCards } from 'common';

/**
 * Steal prompt. Shown after the robber is placed and there is at least one
 * eligible victim. The thief picks a face-down card from a victim:
 *  - other players see a "X is choosing a card to steal" notice;
 *  - the thief picks a victim, then one of their cards (rendered face-down,
 *    in the same fixed order the backend uses, so the card at index `i` is
 *    the same in both).
 * The cards are face-down ("?"), but the thief can infer which resource a
 * tile is from the victim's visible resource counts + position.
 */
const StealPrompt: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { chooseSteal } = useSocket();
  const [selectedVictim, setSelectedVictim] = useState<string | null>(null);

  if (!gameRoom || !currentPlayer || !gameRoom.steal) return null;
  const { thief, victims, reason } = gameRoom.steal;

  // Other players see a notice that the thief is choosing.
  if (thief !== currentPlayer.name) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 shadow-lg">
        <span className="text-[13px] font-semibold text-amber-800">
          {thief} is choosing a card to steal
        </span>
      </div>
    );
  }

  const selectedPlayer = gameRoom.players.find((p) => p.name === selectedVictim);
  const cards = selectedPlayer ? expandCards(selectedPlayer.resources) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-[480px] max-w-full">
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
            const count = player
              ? Object.values(player.resources).reduce((a, b) => a + b, 0)
              : 0;
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
              Take one of {selectedPlayer.name}&apos;s {cards.length} card
              {cards.length === 1 ? '' : 's'}:
            </p>
            <div className="flex gap-2 flex-wrap">
              {cards.map((_, i) => (
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
