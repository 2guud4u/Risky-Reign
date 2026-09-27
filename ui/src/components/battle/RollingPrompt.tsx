import React from 'react';

interface RollingPromptProps {
  /** "X to roll N dice" lines for owners who still owe a roll this round. */
  waitingLines: string[];
}

/**
 * Rolling-phase banner: players roll their own dice, one per troop. Hidden
 * outside the 'rolling' phase.
 */
export const RollingPrompt: React.FC<RollingPromptProps> = ({ waitingLines }) => (
  <div className="text-[13px] text-gray-600 bg-amber-50 border border-amber-200 rounded-md p-2">
    Click your troops to roll — one die each. Rolled troops advance to
    the center line. Highest rolls fight highest rolls.
    {waitingLines.length > 0 && (
      <div className="text-gray-500 mt-1">Waiting: {waitingLines.join(' · ')}</div>
    )}
  </div>
);
