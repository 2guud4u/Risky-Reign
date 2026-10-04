import React from 'react';
import { DiceMatch } from '../../types/battleModal';
import Dice from '../Dice';

/** Pip-die size in the matchup rows (px). */
const MATCHUP_DIE_SIZE = 30;

interface DiceMatchupPanelProps {
  /** Compared die pairs from the just-resolved round. */
  matchup: DiceMatch[];
  attacker: string;
  defender: string;
}

/**
 * How the dice compared in the just-resolved round (highest vs highest): one
 * row per pair — attacker die vs defender die, with the result underneath.
 * The higher die is ringed; a tie rings neither.
 */
export const DiceMatchupPanel: React.FC<DiceMatchupPanelProps> = ({ matchup, attacker, defender }) =>
  matchup.length === 0 ? null : (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[1fr_auto_1fr] text-[11px] font-semibold text-gray-500 px-1">
        <span className="truncate">{attacker}</span>
        <span />
        <span className="truncate text-right">{defender || 'Defender'}</span>
      </div>
      {matchup.map((m, i) => (
        <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <span className={`justify-self-start rounded-lg ${m.a > m.d ? 'ring-2 ring-red-500' : ''}`}>
              <Dice value={m.a} size={MATCHUP_DIE_SIZE} />
            </span>
            <span className="text-[11px] font-bold text-gray-400 px-2">vs</span>
            <span className={`justify-self-end rounded-lg ${m.d > m.a ? 'ring-2 ring-blue-500' : ''}`}>
              <Dice value={m.d} size={MATCHUP_DIE_SIZE} />
            </span>
          </div>
          <div className={`text-center text-[12px] font-semibold mt-1 ${m.cls}`}>{m.text}</div>
        </div>
      ))}
    </div>
  );
