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
 * Between rounds only: the attacker fights another round or stops; everyone
 * else is told who they're waiting on. With one side gone, the only choice is
 * to see the result.
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
  const bothStanding = attackerAlive && defenderAlive;
  if (!canContinue) {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[13px] text-gray-600">
        Waiting for <strong>{battle.attacker}</strong> to {bothStanding ? 'fight on or stop' : 'see the result'}…
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {bothStanding && (
        <button
          type="button"
          onClick={onContinue}
          className="w-full bg-red-600 text-white rounded-lg py-2.5 text-[14px] font-bold shadow hover:bg-red-700 cursor-pointer"
        >
          ⚔️ Fight round {battle.round + 1}
        </button>
      )}
      <button
        type="button"
        onClick={onEnd}
        className={`w-full rounded-lg py-2 text-[13px] font-semibold cursor-pointer ${
          bothStanding
            ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
            : 'bg-red-600 text-white shadow hover:bg-red-700'
        }`}
      >
        {bothStanding ? 'Stop the battle here' : 'See result →'}
      </button>
    </div>
  );
};
