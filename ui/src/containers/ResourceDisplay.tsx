import React from 'react';
import { Player } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

/**
 * The current player's resource cards, shown as a single vertical column
 * overlaid on the right-middle of the board. `data-resource-section` marks
 * the landing point for the flying resource-gain icons.
 */
const ResourceDisplay: React.FC = () => {
  const { currentPlayer } = useGameRoom();
  if (!currentPlayer) return null;
  const me: Player = currentPlayer;
  return (
    <div
      data-resource-section="true"
      className="flex flex-col gap-1.5 bg-white/85 backdrop-blur-sm rounded-lg shadow p-2"
    >
      <div className="text-[12px] font-semibold text-gray-600 text-center">
        Your Resources
      </div>
      {Object.entries(me.resources).map(([resource, count]) => (
        <div
          key={resource}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-300 bg-white text-[13px] shadow-sm"
          title={`${resource}: ${count}`}
        >
          <span>{RESOURCE_ICONS[resource as keyof typeof RESOURCE_ICONS] ?? '❓'}</span>
          <strong>{count}</strong>
        </div>
      ))}
    </div>
  );
};

export default ResourceDisplay;
