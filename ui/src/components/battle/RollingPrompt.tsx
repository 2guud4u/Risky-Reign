import React from 'react';

interface RollingPromptProps {
  /** "X to roll N dice" lines for owners who still owe a roll this round. */
  waitingLines: string[];
  /** True while a roll is in flight (clicked, awaiting the result). */
  rolling: boolean;
}

/**
 * Rolling-phase banner: players roll their own dice, one per troop. Hidden
 * outside the 'rolling' phase. Prominent (bold, pulsing) so the "click a
 * troop to roll" cue is impossible to miss — a missed cue is what made the
 * fight feel like it hung with no result.
 */
export const RollingPrompt: React.FC<RollingPromptProps> = ({ waitingLines, rolling }) => (
  <div className="text-[15px] font-bold text-amber-800 bg-amber-100 border-2 border-amber-400 rounded-md p-3 blink-circle">
    {rolling ? (
      'Rolling…'
    ) : (
      <>
        🎲 <strong>Click a glowing troop to roll its die</strong> — each front-line troop rolls
        once. Your strongest rolls face their strongest.
      </>
    )}
    {waitingLines.length > 0 && (
      <div className="text-[13px] font-normal text-amber-700 mt-1">
        Waiting on: {waitingLines.join(', ')}
      </div>
    )}
  </div>
);
