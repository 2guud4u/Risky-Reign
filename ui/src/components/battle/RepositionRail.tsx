import React from 'react';
import { RepositionTroop } from '../../types/battleModal';
import { FALLBACK_OWNER_COLOR } from '../../utils/battleModal';
import { sectionTitleClass } from '../../styles';

interface RepositionRailProps {
  /** Injured survivors still on the battle vertex, waiting to be placed. */
  stagedTroops: RepositionTroop[];
  /** The currently-selected staged troop, if any. */
  selectedSoldierId: string | null;
  /** Valid target vertices for the selected troop (empty when none selected). */
  selectedTargetCount: number;
  currentPlayerName: string | undefined;
  colors: Record<string, string>;
  isMyRepositionTurn: boolean;
  onSelect: (troop: RepositionTroop) => void;
}

/**
 * Injured troops still on the battle vertex. The active player clicks one
 * (its road-adjacent targets light up on the map), then clicks a target.
 */
export const RepositionRail: React.FC<RepositionRailProps> = ({
  stagedTroops,
  selectedSoldierId,
  selectedTargetCount,
  currentPlayerName,
  colors,
  isMyRepositionTurn,
  onSelect,
}) =>
  stagedTroops.length === 0 ? null : (
    <div className="flex flex-col gap-1">
      <div className={sectionTitleClass}>Injured</div>
      <div className="flex flex-wrap gap-1">
        {stagedTroops.map((t) => {
          const mine = t.ownerName === currentPlayerName;
          const sel = selectedSoldierId === t.soldierId;
          const canClick = mine && isMyRepositionTurn;
          return (
            <button
              key={t.soldierId}
              type="button"
              onClick={() => canClick && onSelect(t)}
              disabled={!canClick}
              title={t.ownerName}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[12px] font-semibold ${
                sel
                  ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-400'
                  : canClick
                  ? 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer blink-circle'
                  : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ background: colors[t.ownerName] ?? FALLBACK_OWNER_COLOR }}
              />
              {t.ownerName}
            </button>
          );
        })}
      </div>
      {isMyRepositionTurn && selectedSoldierId && (
        <p className="text-[12px] text-emerald-700 m-0">
          {selectedTargetCount > 0 ? 'Click a glowing vertex' : 'No road out'}
        </p>
      )}
    </div>
  );
