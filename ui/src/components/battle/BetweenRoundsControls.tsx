import React from 'react';
import { BattleState } from 'common';
import GameIcon from '../ui/GameIcon';
import Button from '../ui/Button';

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
      <div className="rounded-lg bg-canvas-sunken border border-ink-faint/40 px-3 py-2 text-[13px] text-ink-soft">
        Waiting for <strong>{battle.attacker}</strong> to {bothStanding ? 'fight on or stop' : 'see the result'}…
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {bothStanding && (
        <Button
          variant="danger"
          onClick={onContinue}
          className="w-full !rounded-lg"
        >
          <GameIcon name="attack" size={14} className="inline -mt-0.5" /> Fight round {battle.round + 1}
        </Button>
      )}
      <div className="flex flex-col gap-1">
        <Button
          variant={bothStanding ? 'secondary' : 'danger'}
          onClick={onEnd}
          className="w-full !rounded-lg"
        >
          {bothStanding ? 'Stop the battle here' : <>See result <GameIcon name="arrowRight" size={12} className="inline -mt-0.5" /></>}
        </Button>
        {bothStanding && (
          <div className="text-[11px] text-clay text-center">
            <GameIcon name="warning" size={11} className="inline -mt-0.5" /> Ending now counts as a loss
          </div>
        )}
      </div>
    </div>
  );
};
