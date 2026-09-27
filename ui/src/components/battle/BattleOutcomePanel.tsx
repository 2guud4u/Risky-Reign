import React from 'react';
import { adjacentHexIds, BattleState, Board, Player } from 'common';
import { BattleOutcome } from '../../types/battleModal';

interface BattleOutcomePanelProps {
  battle: BattleState;
  board: Board;
  outcome: BattleOutcome | null;
  currentPlayer: Player | null;
  roomId: string;
  robberDefeatedBy: { playerName: string; fromHexId: string } | null;
  finishRepositioning: (playerId: string, roomId: string) => void;
  moveRobberAfterWin: (playerId: string, hexId: string, roomId: string) => void;
  onExit: () => void;
}

/**
 * Battle over: show the outcome and let players exit. In the repositioning
 * phase the window stays open so owners can drag their injured troops to a
 * neighboring vertex (or leave them in place).
 */
export const BattleOutcomePanel: React.FC<BattleOutcomePanelProps> = ({
  battle,
  board,
  outcome,
  currentPlayer,
  roomId,
  robberDefeatedBy,
  finishRepositioning,
  moveRobberAfterWin,
  onExit,
}) => {
  const phase = battle.phase;
  if ((phase !== 'repositioning' && phase !== 'finished') || !outcome) return null;
  return (
    <div className="border border-gray-300 rounded-lg p-3 flex flex-col gap-2">
      <div className="text-[14px] font-semibold">
        {outcome.winner
          ? `🏆 ${outcome.winner} wins the battle!`
          : 'The battle is a draw.'}
      </div>
      <div className="text-[12px] text-gray-600">
        {battle.attacker}: {outcome.atkAlive} standing, {outcome.atkDead} killed,{' '}
        {outcome.atkInj} injured
      </div>
      <div className="text-[12px] text-gray-600">
        {battle.defender || 'Defender'}: {outcome.defAlive} standing, {outcome.defDead} killed,{' '}
        {outcome.defInj} injured
      </div>

      {phase === 'repositioning' && (
        <div className="text-[12px] text-gray-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          {battle.repositionTurn === null ? (
            <span>
              Repositioning is done.
            </span>
          ) : (
            <>
              <strong>
                {battle.repositionTurn === 'attacker'
                  ? `${battle.attacker} (attacker) moves first`
                  : `${battle.defender || 'Defender'} moves next`}
              </strong>{' '}
              — drag the yellow-ringed injured troops to a neighboring
              vertex connected by a road to settle them. Any you leave
              stay put. You can exit at any time.
            </>
          )}
        </div>
      )}

      {phase === 'finished' && (
        <div className="text-[11px] text-gray-400">
          Healthy troops stay where the fight ended.
        </div>
      )}

      {/* The side whose repositioning turn it is finishes first
          (attacker before defender). */}
      {phase === 'repositioning' &&
        battle.repositionTurn !== null &&
        battle.repositionTurn !== undefined &&
        (() => {
          const isAttacker = currentPlayer?.name === battle.attacker;
          const isDefender = currentPlayer?.name === battle.defender;
          if (!isAttacker && !isDefender) return null;
          if (battle.repositionTurn !== (isAttacker ? 'attacker' : 'defender')) return null;
          // All of this side's injured troops must be moved (off the
          // battle vertex) before the player can confirm.
          const mySide = isAttacker ? battle.attacker : battle.defender;
          const myInjured = (battle.states[mySide]?.soldiers ?? []).filter(
            (s) => s.injured && !s.dead
          );
          const settled = battle.injuredSettled ?? {};
          const allMoved = myInjured.every(
            (s) => settled[s.soldier.id] !== battle.vertexId
          );
          return (
            <button
              type="button"
              disabled={!allMoved}
              onClick={() => finishRepositioning(currentPlayer!.id, roomId)}
              className={`w-full rounded-md py-2 text-sm font-semibold ${
                allMoved
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title={allMoved ? 'Confirm your troop moves' : 'Move all your injured troops before confirming'}
            >
              Confirm Move Troops
            </button>
          );
        })()}

      {/* After defeating the robber, the winner may move it to any
          adjacent hex (Rules.md). */}
      {robberDefeatedBy &&
        robberDefeatedBy.playerName === currentPlayer?.name && (
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-semibold text-gray-600">
            🛡 You defeated the robber — move it to an adjacent hex:
          </div>
          <div className="flex flex-wrap gap-1">
            {adjacentHexIds(board, robberDefeatedBy.fromHexId)
              .filter((hexId) => board.hexes[hexId]?.terrain !== 'Desert')
              .map((hexId) => {
                const hex = board.hexes[hexId];
                return (
                  <button
                    key={hexId}
                    type="button"
                    onClick={() => moveRobberAfterWin(currentPlayer!.id, hexId, roomId)}
                    className="px-2 py-1 rounded border border-gray-300 bg-white text-[12px] hover:bg-gray-100"
                    title={`Move the robber to the ${hex.terrain} hex`}
                  >
                    {hex.terrain}
                    {hex.rollNumber !== null ? ` (${hex.rollNumber})` : ''}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className="w-full bg-gray-800 text-white rounded-md py-2 text-sm font-semibold hover:bg-gray-900"
      >
        Exit Battle
      </button>
    </div>
  );
};
