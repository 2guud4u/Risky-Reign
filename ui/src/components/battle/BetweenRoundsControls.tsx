import React from 'react';
import { BattleState } from 'common';

interface BetweenRoundsControlsProps {
  battle: BattleState;
  /** True when the current player is the attacker deciding the next round. */
  canContinue: boolean;
  attackerAlive: boolean;
  defenderAlive: boolean;
  onContinue: () => void;
  onEnd: () => void;
}

/**
 * Between rounds only: the attacker continues or ends; everyone else waits.
 */
export const BetweenRoundsControls: React.FC<BetweenRoundsControlsProps> = ({
  battle,
  canContinue,
  attackerAlive,
  defenderAlive,
  onContinue,
  onEnd,
}) => {
  if (battle.phase !== 'betweenRounds') return null;
  if (!canContinue) {
    return <div className="text-[13px] text-gray-500">Waiting for {battle.attacker}…</div>;
  }
  const bothStanding = attackerAlive && defenderAlive;
  return (
    <div className="flex gap-2">
      {bothStanding && (
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 bg-red-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-red-700"
        >
          Round {battle.round + 1}
        </button>
      )}
      <button
        type="button"
        onClick={onEnd}
        className={`flex-1 text-white rounded-md py-2 text-sm font-semibold ${
          bothStanding ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        End battle
      </button>
    </div>
  );
};
