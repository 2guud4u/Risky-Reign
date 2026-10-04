import React from 'react';
import { adjacentHexIds, BattleState, Board, injuredLeftToMove, Player } from 'common';
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
  /** Repositioning controls (the injured-troop picker), shown under the prompt. */
  children?: React.ReactNode;
}

/** One side's tally: standing / injured / killed as icon counts. */
const Tally: React.FC<{ name: string; alive: number; inj: number; dead: number }> = ({ name, alive, inj, dead }) => (
  <div className="flex items-center justify-between text-[13px]">
    <span className="font-semibold truncate">{name}</span>
    <span className="flex gap-2 text-gray-600 shrink-0" title="standing / injured / killed">
      <span>🛡 {alive}</span>
      <span className="text-amber-600">✚ {inj}</span>
      <span className="text-red-600">☠ {dead}</span>
    </span>
  </div>
);

/**
 * Battle over: the outcome plus the repositioning / robber / exit controls.
 * The window stays open until every injured troop has moved off the battle
 * vertex (unless there is no road out).
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
  children,
}) => {
  const phase = battle.phase;
  if ((phase !== 'repositioning' && phase !== 'finished') || !outcome) return null;
  // Robber fight: show both dice; the attacker wins only on a strictly higher roll.
  const soldierRoll = battle.robberFight ? battle.states[battle.attacker]?.soldiers[0]?.rollNum ?? null : null;
  const robberRoll = battle.robberFight ? battle.states['Robber']?.soldiers[0]?.rollNum ?? null : null;
  const wonRoll = soldierRoll !== null && robberRoll !== null && soldierRoll > robberRoll;

  const turn = battle.repositionTurn ?? null;
  const pending = phase === 'repositioning' && turn !== null;
  const isAttacker = currentPlayer?.name === battle.attacker;
  const isDefender = currentPlayer?.name === battle.defender;
  const myTurn = pending && (isAttacker || isDefender) && turn === (isAttacker ? 'attacker' : 'defender');
  const allMoved =
    myTurn && injuredLeftToMove(board, battle, isAttacker ? battle.attacker : battle.defender).length === 0;
  const moverName = turn === 'attacker' ? battle.attacker : battle.defender;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[15px] font-bold">{outcome.winner ? `🏆 ${outcome.winner} wins` : 'Draw'}</div>

      {battle.robberFight ? (
        <div className="text-[13px]">
          🎲 {soldierRoll} vs robber {robberRoll} — {wonRoll ? 'bag taken' : 'soldier killed'}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <Tally name={battle.attacker} alive={outcome.atkAlive} inj={outcome.atkInj} dead={outcome.atkDead} />
          <Tally name={battle.defender || 'Defender'} alive={outcome.defAlive} inj={outcome.defInj} dead={outcome.defDead} />
        </div>
      )}

      {pending && (
        <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
          {myTurn ? 'Move your injured troops off the battle site' : `${moverName} is moving injured troops…`}
        </div>
      )}

      {phase === 'repositioning' && children}

      {myTurn && (
        <button
          type="button"
          disabled={!allMoved}
          onClick={() => finishRepositioning(currentPlayer!.id, roomId)}
          className={`w-full rounded-md py-2 text-sm font-semibold ${
            allMoved ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Confirm moves
        </button>
      )}

      {/* After defeating the robber, the winner may move it to an adjacent hex. */}
      {robberDefeatedBy && robberDefeatedBy.playerName === currentPlayer?.name && (
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-semibold text-gray-600">Move robber to:</div>
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
        disabled={pending}
        className={`w-full rounded-md py-2 text-sm font-semibold ${
          pending ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-900'
        }`}
      >
        Close
      </button>
    </div>
  );
};
