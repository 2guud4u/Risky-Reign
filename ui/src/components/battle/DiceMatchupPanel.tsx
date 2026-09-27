import React from 'react';
import { DiceMatch } from '../../types/battleModal';

interface DiceMatchupPanelProps {
  /** Current 1-based round number. */
  round: number;
  /** Compared die pairs from the just-resolved round. */
  matchup: DiceMatch[];
}

/** How the dice compared in the just-resolved round (highest vs highest). */
export const DiceMatchupPanel: React.FC<DiceMatchupPanelProps> = ({ round, matchup }) => (
  <div className="border border-gray-200 rounded-lg p-3">
    <div className="text-[13px] font-semibold mb-1.5">
      Round {round} results — highest die fights highest die
    </div>
    {matchup.length === 0 ? (
      <div className="text-gray-400 text-xs">No dice were rolled this round</div>
    ) : (
      <div className="flex flex-col gap-1">
        {matchup.map((m, i) => (
          <div key={i} className="text-xs flex items-center gap-2">
            <span className="font-mono">{m.a}</span>
            <span className="text-gray-500">vs</span>
            <span className="font-mono">{m.d}</span>
            <span className={`ml-1 ${m.cls}`}>→ {m.text}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);
