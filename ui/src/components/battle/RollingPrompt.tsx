import React from 'react';

interface RollingPromptProps {
  /** "Name (N)" entries for owners who still owe a roll this round. */
  waitingLines: string[];
  /** True while a roll is in flight (clicked, awaiting the result). */
  rolling: boolean;
  /** True when I still have a troop to roll this round. */
  myRollPending: boolean;
}

/**
 * Rolling-phase prompt. When I owe a roll it is bold and pulsing so the
 * "click a troop to roll" cue can't be missed; otherwise it calmly says who
 * the round is waiting on.
 */
export const RollingPrompt: React.FC<RollingPromptProps> = ({ waitingLines, rolling, myRollPending }) =>
  myRollPending || rolling ? (
    <div className="rounded-lg bg-amber-100 border-2 border-amber-400 px-3 py-2 text-amber-900 blink-circle">
      <div className="text-[14px] font-bold">{rolling ? '🎲 Rolling…' : '🎲 Your roll'}</div>
      {!rolling && <div className="text-[12px]">Click each glowing troop on the map to roll its die.</div>}
    </div>
  ) : (
    <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[13px] text-gray-600">
      {waitingLines.length > 0 ? <>Waiting for {waitingLines.join(', ')} to roll…</> : 'Resolving…'}
    </div>
  );
