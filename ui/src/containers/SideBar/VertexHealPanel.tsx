import React from 'react';
import { ResourceCount, ResourceKey, SoldierObj, HealSoldierResources, HealSoldierAmount } from 'common';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';
import { sectionTitleClass } from './styles';

interface VertexHealPanelProps {
  /** My injured soldiers garrisoned on this (my) settlement vertex. */
  injured: SoldierObj[];
  /** Whether the soldier can currently be healed (turn/phase/action budget). */
  canHeal: (soldierId: string) => boolean;
  /** Current player's resources, for affordability of each pay option. */
  resources: ResourceCount;
  onHeal: (soldierId: string, payWith: ResourceKey) => void;
}

/**
 * Direct heal action on a settlement the player owns: each injured soldier
 * gets a row with a payment choice — heal for 1 Wheat or 1 Sheep.
 */
const VertexHealPanel: React.FC<VertexHealPanelProps> = ({ injured, canHeal, resources, onHeal }) => {
  if (injured.length === 0) return null;
  return (
    <div className="border border-emerald-200 bg-emerald-50/60 rounded-md p-2.5 flex flex-col gap-2">
      <div className={sectionTitleClass}>Heal on your settlement</div>
      {injured.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-gray-700">✚ {s.owner}</span>
          {canHeal(s.id) ? (
            <div className="flex gap-1.5">
              {HealSoldierResources.map((r) => {
                const afford = (resources[r] ?? 0) >= HealSoldierAmount;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={!afford}
                    onClick={() => onHeal(s.id, r)}
                    title={`Heal for ${HealSoldierAmount} ${r}`}
                    className={`px-1.5 py-0.5 text-[11px] font-semibold rounded border cursor-pointer ${
                      afford
                        ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {HealSoldierAmount} {RESOURCE_ICONS[r]}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-[11px] text-gray-400">already acted</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default VertexHealPanel;
