import React from 'react';
import { DiceMatch } from '../../types/battleModal';

interface DiceMatchupPanelProps {
  /** Compared die pairs from the just-resolved round. */
  matchup: DiceMatch[];
}

/** How the dice compared in the just-resolved round (highest vs highest). */
export const DiceMatchupPanel: React.FC<DiceMatchupPanelProps> = ({ matchup }) =>
  matchup.length === 0 ? null : (
    <div className="flex flex-col gap-0.5">
      {matchup.map((m, i) => (
        <div key={i} className="text-[13px] flex items-center gap-2">
          <span className="font-mono font-bold w-4 text-right">{m.a}</span>
          <span className="text-gray-400">–</span>
          <span className="font-mono font-bold w-4">{m.d}</span>
          <span className={m.cls}>{m.text}</span>
        </div>
      ))}
    </div>
  );
