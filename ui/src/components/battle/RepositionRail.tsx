import React from 'react';
import { RepositionTroop } from '../../types/battleModal';
import { FALLBACK_OWNER_COLOR } from '../../utils/battleModal';
import { sectionTitleClass } from '../../containers/SideBar/styles';

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
 * The left staging column: injured troops collect here after the battle.
 * The active player clicks a troop to select it (its road-adjacent targets
 * light up on the map), then clicks a target vertex to place it.
 */
export const RepositionRail: React.FC<RepositionRailProps> = ({
  stagedTroops,
  selectedSoldierId,
  selectedTargetCount,
  currentPlayerName,
  colors,
  isMyRepositionTurn,
  onSelect,
}) => (
  <div className="w-40 shrink-0 flex flex-col gap-2 border-r border-gray-200 pr-3">
    <div className={sectionTitleClass}>Injured to place</div>
    {stagedTroops.length === 0 ? (
      <p className="text-[12px] text-gray-400 m-0">None left to place.</p>
    ) : (
      <div className="flex flex-col gap-1.5">
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
              title={mine ? 'Select, then click a lit vertex' : `${t.ownerName}'s troop`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-left text-[12px] font-semibold ${
                sel
                  ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-400'
                  : mine
                  ? 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}
            >
              <span
                className="w-4 h-4 rounded-sm inline-block"
                style={{ background: colors[t.ownerName] ?? FALLBACK_OWNER_COLOR }}
              />
              <span className="truncate">{t.ownerName}</span>
            </button>
          );
        })}
      </div>
    )}
    {isMyRepositionTurn && selectedSoldierId && (
      <p className="text-[11px] text-emerald-700 m-0">
        {selectedTargetCount > 0
          ? 'Click a glowing vertex to place this troop.'
          : 'No road-adjacent vertex to move to.'}
      </p>
    )}
    {!isMyRepositionTurn && stagedTroops.length > 0 && (
      <p className="text-[11px] text-gray-400 m-0">Waiting for the other side to reposition.</p>
    )}
  </div>
);
