import React from 'react';
import { BattleState } from 'common';

/**
 * Small notice shown in the vertex sidebar while a battle is running,
 * pointing the player to the Battle tab for details.
 */
const VertexBattleNotice: React.FC<{ battle: BattleState }> = ({ battle }) => (
  <div className="border border-amber-300 bg-amber-50 rounded-md p-2 text-xs">
    <div className="font-semibold mb-1">⚔ Battle at {battle.vertexId}</div>
    <div className="text-gray-700">
      {battle.attacker} attacks {battle.defender || '—'} — see the Battle tab for details.
    </div>
  </div>
);

export default VertexBattleNotice;
