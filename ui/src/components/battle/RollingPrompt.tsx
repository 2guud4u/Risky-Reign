import React from 'react';

interface RollingPromptProps {
  /** "Name (N)" entries for owners who still owe a roll this round. */
  waitingLines: string[];
  /** True while a roll is in flight (clicked, awaiting the result). */
  rolling: boolean;
}

/**
 * Rolling-phase banner. Bold and pulsing so the "click a troop to roll" cue
 * is impossible to miss — a missed cue made the fight feel hung.
 */
export const RollingPrompt: React.FC<RollingPromptProps> = ({ waitingLines, rolling }) => (
  <div className="text-[14px] font-bold text-amber-800 bg-amber-100 border-2 border-amber-400 rounded-md px-3 py-2 blink-circle">
    {rolling ? 'Rolling…' : '🎲 Click a glowing troop to roll'}
    {waitingLines.length > 0 && (
      <div className="text-[12px] font-normal text-amber-700">Waiting on {waitingLines.join(', ')}</div>
    )}
  </div>
);
