import React from 'react';
import { SoldierObj, VertexId } from 'common';
import { buildButtonClass, sectionTitleClass } from './styles';
import { HEAL_PAY_OPTIONS } from './constants';

interface VertexGroupPanelProps {
  group: SoldierObj[];
  healableSoldiers: SoldierObj[];
  /** Road-adjacent vertex ids every group member can move to. */
  moveTargets: VertexId[];
  nicknames: Record<string, string>;
  isMyTurnActionPhase: boolean;
  battleInProgress: boolean;
  groupReady: boolean;
  canAttackGroup: boolean;
  canCaptureGroup: boolean;
  canFightRobberGroup: boolean;
  enemyTroopCount: number;
  settlementIsCity: boolean;
  onClearGroup: () => void;
  onHealSoldier: (soldierId: string, payWith?: 'Wheat' | 'Sheep') => void;
  onGroupMove: (targetVertexId: string) => void;
  onConfirmAttack: () => void;
  onCaptureSettlement: () => void;
  onFightRobber: () => void;
}

/**
 * The "Your Group" panel in the vertex sidebar: the selected soldiers, heal
 * buttons for injured members, and the group actions (move/attack/capture/
 * robber). Rendered by `Vertex` only once at least one soldier is selected.
 */
const VertexGroupPanel: React.FC<VertexGroupPanelProps> = ({
  group,
  healableSoldiers,
  moveTargets,
  nicknames,
  isMyTurnActionPhase,
  battleInProgress,
  groupReady,
  canAttackGroup,
  canCaptureGroup,
  canFightRobberGroup,
  enemyTroopCount,
  settlementIsCity,
  onClearGroup,
  onHealSoldier,
  onGroupMove,
  onConfirmAttack,
  onCaptureSettlement,
  onFightRobber,
}) => {
  const injured = group.filter((s) => s.injured);

  return (
    <div className="border border-blue-200 bg-blue-50/60 rounded-md p-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={sectionTitleClass}>Your Group ({group.length})</div>
        <button
          type="button"
          onClick={onClearGroup}
          className="text-[11px] text-gray-400 hover:text-gray-700"
        >
          ✕ Clear
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {group.map((s) => (
          <span
            key={s.id}
            className={`px-1.5 py-0.5 rounded text-[11px] border ${
              s.injured ? 'bg-red-100 border-red-200 text-red-700' : 'bg-white border-gray-300'
            }`}
          >
            {s.owner}
            {s.injured ? ' (injured)' : ''}
          </span>
        ))}
      </div>

      {!isMyTurnActionPhase && (
        <div className="text-gray-100 text-[11px]">Actions available on your Action phase.</div>
      )}
      {isMyTurnActionPhase && battleInProgress && (
        <div className="text-gray-100 text-[11px]">A battle is already in progress.</div>
      )}

      {/* Heal actions for injured members — the player pays 1 of either Wheat or Sheep. */}
      {injured.length > 0 && (
        <div className="flex flex-col gap-1">
          {healableSoldiers.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-gray-700">✚ {s.owner}</span>
              <div className="flex gap-1.5">
                {HEAL_PAY_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => onHealSoldier(s.id, r)}
                    title={`Heal ${s.owner} for 1 ${r}`}
                    className="px-1.5 py-0.5 text-[11px] font-semibold rounded border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  >
                    1 {r === 'Wheat' ? '🌾' : '🐑'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Move actions for the (actionable) group — injured included. */}
      {groupReady && (
        <div>
          <div className="text-[12px] font-semibold text-gray-600 mb-1">
            Move all {group.length} to:
          </div>
          <div className="flex flex-col gap-1">
            {moveTargets.map((targetId) => (
              <button
                key={targetId}
                onClick={() => onGroupMove(targetId)}
                className={buildButtonClass}
                title={`Move the group to ${targetId}`}
              >
                → Move to {nicknames[targetId] ?? targetId}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attack action — only when every group member is uninjured (Rule 28). */}
      {canAttackGroup && enemyTroopCount > 0 && (
        <button
          onClick={onConfirmAttack}
          className={buildButtonClass}
          title={`Attack the ${enemyTroopCount} enemy troop(s) on this vertex`}
        >
          ⚔ Attack {enemyTroopCount} enemy troop{enemyTroopCount === 1 ? '' : 's'} here
        </button>
      )}

      {/* Capture action — the vertex holds a settlement/city that is not
          ours and no enemy or other troops are on the vertex. */}
      {canCaptureGroup && (
        <button
          onClick={onCaptureSettlement}
          className={buildButtonClass}
          title={`Capture the ${settlementIsCity ? 'city' : 'settlement'} on this vertex`}
        >
          🚩 Capture {settlementIsCity ? 'City' : 'Settlement'}
        </button>
      )}

      {/* Robber fight — the robber sits on one of this vertex's hexes;
          1v1, once per player per Action phase. */}
      {canFightRobberGroup && (
        <button
          onClick={onFightRobber}
          className={buildButtonClass}
          title="Fight the robber 1v1 — win the robber bag or lose the soldier (once per phase)"
        >
          🛡 Fight the Robber
        </button>
      )}
    </div>
  );
};

export default VertexGroupPanel;
