import React from 'react';
import { RESOURCES } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';

/**
 * The robber's bag: every resource card discarded by the 7 rule, plus the
 * resources produced by hexes the robber currently sits on.
 */
const RobberBagView: React.FC = () => {
  const { gameRoom } = useGameRoom();

  if (!gameRoom || !gameRoom.robberBag) return null;

  const bag = gameRoom.robberBag;
  const total = RESOURCES.reduce((sum, r) => sum + bag[r], 0);

  return (
    <div className=" p-3.5 bg-white flex flex-col gap-2">
      <div className="text-sm font-semibold">Robber's Bag</div>
      <div className="text-xs text-gray-500">
        {total} card{total === 1 ? '' : 's'}
      </div>
      <div className="flex gap-2 flex-wrap">
        {RESOURCES.filter((r) => bag[r] > 0).map((r) => (
          <div
            key={r}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-gray-50"
          >
            <span className="text-lg">{RESOURCE_ICONS[r]}</span>
            <span className="text-sm font-semibold text-gray-700">{bag[r]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RobberBagView;
