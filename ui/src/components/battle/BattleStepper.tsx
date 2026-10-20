import React from 'react';
import { BattlePhase } from 'common';
import GameIcon from '../ui/GameIcon';

/** The battle's stages, in order, as the player sees them. */
const STEPS = [
  { key: 'roll', label: 'Roll' },
  { key: 'result', label: 'Result' },
  { key: 'retreat', label: 'Retreat' },
  { key: 'done', label: 'Done' },
] as const;

/** Map an engine phase (+ whether anyone still has to move) to a step index. */
const stepIndex = (phase: BattlePhase, retreatPending: boolean): number => {
  switch (phase) {
    case 'rolling':
      return 0;
    case 'betweenRounds':
      return 1;
    case 'repositioning':
      return retreatPending ? 2 : 3;
    case 'finished':
      return 3;
  }
};

/**
 * Compact progress bar across the top of the battle window: Roll → Result →
 * Retreat → Done, with the current step highlighted. The Retreat step is
 * skipped (shown done) when nobody has injured troops to move.
 */
export const BattleStepper: React.FC<{ phase: BattlePhase; retreatPending: boolean; round: number }> = ({
  phase,
  retreatPending,
  round,
}) => {
  const current = stepIndex(phase, retreatPending);
  return (
    <ol className="flex items-center gap-1 m-0 p-0 list-none text-[12px]">
      {STEPS.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'next';
        return (
          <React.Fragment key={s.key}>
            {i > 0 && <span className={`w-6 h-0.5 ${i <= current ? 'bg-clay' : 'bg-canvas-sunken'}`} aria-hidden="true" />}
            <li
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold ${
                state === 'now'
                  ? 'bg-clay text-white'
                  : state === 'done'
                  ? 'bg-clay-pale text-clay'
                  : 'bg-canvas-sunken text-ink-faint'
              }`}
              aria-current={state === 'now' ? 'step' : undefined}
            >
              {state === 'done' ? <GameIcon name="check" size={12} /> : i + 1}
              <span>{s.key === 'roll' && round > 1 ? `Roll · round ${round}` : s.label}</span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
};
