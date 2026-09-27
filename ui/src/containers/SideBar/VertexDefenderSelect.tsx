import React from 'react';
import { buildButtonClass } from './styles';

interface VertexDefenderSelectProps {
  /** One entry per distinct enemy group on the vertex. */
  defenders: { owner: string; count: number; injuredCount: number }[];
  onSelect: (defenderName: string) => void;
  onCancel: () => void;
}

/**
 * Defender selection dialog for the vertex panel: shown when multiple enemy
 * groups occupy the target vertex and the player must choose which to fight.
 */
const VertexDefenderSelect: React.FC<VertexDefenderSelectProps> = ({
  defenders,
  onSelect,
  onCancel,
}) => (
  <div className="border border-blue-300 bg-blue-50 rounded-md p-2.5 flex flex-col gap-2">
    <div className="text-[13px] font-semibold">Choose which group to fight:</div>
    <div className="flex flex-col gap-1">
      {defenders.map(({ owner, count, injuredCount }) => (
        <button
          key={owner}
          onClick={() => onSelect(owner)}
          className={buildButtonClass}
          title={`Fight ${owner}'s ${count} troop(s)`}
        >
          ⚔ Fight {owner} ({count} troop{count === 1 ? '' : 's'}
          {injuredCount > 0 ? `, ${injuredCount} injured` : ''})
        </button>
      ))}
    </div>
    <button onClick={onCancel} className="text-[11px] text-gray-600 hover:text-gray-800">
      ✕ Cancel
    </button>
  </div>
);

export default VertexDefenderSelect;
