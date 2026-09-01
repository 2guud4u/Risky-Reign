import React from 'react';
import { Board, BattleState } from 'common';
import { useGameRoom } from '../../contexts/GameContext';

/**
 * Sidebar tab for an active battle. The actual combat (rolling dice,
 * comparing, continuing) happens in the separate battle window (BattleModal),
 * which opens for every player while a battle is in progress. This tab is a
 * lightweight indicator pointing at the battle location.
 */
const BattleTab: React.FC<{ board: Board; battle: BattleState }> = ({ board, battle }) => {
  const { currentPlayer, setSelectedObject } = useGameRoom();

  const attacker = battle.states[battle.attacker]?.soldiers ?? [];
  const defender =
    battle.defender && battle.states[battle.defender] ? battle.states[battle.defender].soldiers : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px]">
        ⚔ <strong>{battle.attacker}</strong> is attacking{' '}
        <strong>{battle.defender || 'the defender'}</strong> at vertex{' '}
        <strong>{battle.vertexId}</strong>.
      </div>

      <button
        type="button"
        className="text-left text-[13px] hover:underline cursor-pointer"
        onClick={() => setSelectedObject({ type: 'vertex', id: battle.vertexId })}
        title="Show the battle location on the board"
      >
        → Show the battle on the board
      </button>

      <div className="text-[13px] text-gray-600">
        {battle.phase === 'rolling'
          ? `Rolling round ${battle.round}…`
          : `Round ${battle.round} resolved…`}
        <span className="block text-gray-500 text-[12px] mt-1">
          Roll your dice in the battle window (it opened for everyone).
        </span>
      </div>

      <div className="text-[12px] text-gray-500">
        Troops — {battle.attacker}: {attacker.length} · {battle.defender || 'defender'}:{' '}
        {defender.length}
      </div>

      {currentPlayer && battle.attacker === currentPlayer.name && (
        <div className="text-[12px] text-gray-500">
          You are the attacker — use “Continue Battle” in the battle window to roll
          another round or end the fight.
        </div>
      )}
    </div>
  );
};

export default BattleTab;
