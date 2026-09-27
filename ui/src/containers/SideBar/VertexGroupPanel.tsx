import React from 'react';
import { SoldierObj, VertexId } from 'common';
import { buildButtonClass } from './styles';
import { HEAL_COST_LABEL } from './constants';

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
  onHealSoldier: (soldierId: string) => void;
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
        <div className="text-[13px] font-semibold">Your Group ({group.length})</div>
        <button
          type="button"
          onClick={onClearGroup}
          className="text-[11px] text-gray-100 hover:text-gray-700"
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

      {/* Heal actions for injured members. */}
      {injured.length > 0 && (
        <div className="flex flex-col gap-1">
          {healableSoldiers.map((s) => (
            <button
              key={s.id}
              onClick={() => onHealSoldier(s.id)}
              className={buildButtonClass}
              title={`Heal ${s.owner} (${HEAL_COST_LABEL})`}
            >
              ✚ Heal {s.owner}
            </button>
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
