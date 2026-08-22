import React from 'react';
import { Board, BattleState } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';

/**
 * Sidebar tab for the active battle: shows both sides' committed soldiers with
 * their rolls, casualties, and the Continue Battle action for the attacker.
 */
const BattleTab: React.FC<{ board: Board; battle: BattleState }> = ({ board, battle }) => {
  const { gameRoom, currentPlayer, setSelectedObject } = useGameRoom();
  const { continueBattle } = useSocket();

  const canContinue =
    currentPlayer !== null &&
    battle.attacker === currentPlayer.name &&
    (battle.states[battle.attacker]?.soldiers ?? []).some((s) => !s.dead);

  const handleContinue = () => {
    if (!gameRoom || !currentPlayer) return;
    continueBattle(currentPlayer.id, gameRoom.id);
  };

  const renderSide = (playerName: string) => {
    const side = battle.states[playerName];
    if (!side) return null;
    const isAttacker = playerName === battle.attacker;
    return (
      <div className="border border-gray-200 rounded-md p-2 text-xs flex flex-col gap-1">
        <div className="font-semibold">
          {playerName}{' '}
          <span className="text-gray-500 font-normal">({isAttacker ? 'attacker' : 'defender'})</span>
        </div>
        {side.soldiers.length === 0 && (
          <div className="text-gray-400">No soldiers committed</div>
        )}
        {side.soldiers.map((s) => (
          <div key={s.soldier.id} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                s.dead
                  ? 'bg-red-100 text-red-600 line-through'
                  : s.injured
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
              }`}
            >
              {s.rollNum ?? '?'}
            </span>
            <span className={s.dead ? 'text-red-600 line-through' : ''}>
              {s.soldier.type}
              {s.injured && !s.dead && <span className="ml-1 text-amber-700">(injured)</span>}
              {s.dead && <span className="ml-1 text-red-600">(dead)</span>}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-base">⚔ Battle</h3>

      <button
        type="button"
        className="text-left text-[13px] hover:underline cursor-pointer"
        onClick={() => setSelectedObject({ type: 'vertex', id: battle.vertexId })}
        title="Show the battle location on the board"
      >
        At vertex <strong>{battle.vertexId}</strong> — click to view
      </button>

      {renderSide(battle.attacker)}
      {battle.defender && renderSide(battle.defender)}

      {canContinue ? (
        <button
          type="button"
          onClick={handleContinue}
          className="w-full bg-red-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-red-700"
        >
          Continue Battle
        </button>
      ) : (
        <div className="text-[13px] text-gray-500">
          {currentPlayer && battle.attacker !== currentPlayer.name
            ? `Waiting for ${battle.attacker} to continue...`
            : 'Battle in progress...'}
        </div>
      )}
    </div>
  );
};

export default BattleTab;
