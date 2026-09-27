import React from 'react';
import { BattleState, Player } from 'common';

interface BetweenRoundsControlsProps {
  battle: BattleState;
  /** True when the current player is the attacker deciding the next round. */
  canContinue: boolean;
  attackerAlive: boolean;
  defenderAlive: boolean;
  currentPlayer: Player | null;
  onContinue: () => void;
  onEnd: () => void;
}

/**
 * Between rounds only: let the attacker continue or end at their choosing.
 * Everyone else sees a waiting message.
 */
export const BetweenRoundsControls: React.FC<BetweenRoundsControlsProps> = ({
  battle,
  canContinue,
  attackerAlive,
  defenderAlive,
  currentPlayer,
  onContinue,
  onEnd,
}) => {
  if (battle.phase !== 'betweenRounds') return null;
  return canContinue ? (
    <div className="flex flex-col gap-2">
      {attackerAlive && defenderAlive ? (
        <>
          <button
            type="button"
            onClick={onContinue}
            className="w-full bg-red-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-red-700"
          >
            Continue Battle (round {battle.round + 1})
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="w-full bg-gray-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-gray-700"
          >
            End Battle Now
          </button>
          <div className="text-[12px] text-gray-500 text-center">
            You can keep attacking while you have troops left, or end the battle now.
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={onEnd}
          className="w-full bg-red-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-red-700"
        >
          End Battle — a side is defeated
        </button>
      )}
    </div>
  ) : (
    <div className="text-[13px] text-gray-500">
      {currentPlayer && battle.attacker !== currentPlayer.name
        ? `Waiting for ${battle.attacker} to continue or end the battle...`
        : 'Battle in progress...'}
    </div>
  );
};
