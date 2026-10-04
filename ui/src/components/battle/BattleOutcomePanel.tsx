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
  moveRobberAfterWin: (playerId: string, hexId: string, roomId: string) => void;
  onExit: () => void;
  /** Whose turn it is to move injured troops (null = nobody). */
  moverName: string | undefined;
  /** My injured troops still on the battle site (my retreat turn only). */
  myStagedCount: number;
  /** Total injured troops the mover moves this turn (for the "2 of 3" count). */
  moverTotal: number;
}

/** One side's tally as labelled chips. */
const Tally: React.FC<{ name: string; alive: number; inj: number; dead: number; won: boolean }> = ({
  name,
  alive,
  inj,
  dead,
  won,
}) => (
  <div className={`rounded-lg border px-2.5 py-1.5 ${won ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
    <div className="flex items-center gap-1 text-[13px] font-semibold truncate">
      {won && <span aria-hidden="true">🏆</span>}
      {name}
    </div>
    <div className="flex gap-1.5 mt-1 text-[11px] font-semibold">
      <span className="px-1.5 rounded bg-green-100 text-green-800">{alive} standing</span>
      {inj > 0 && <span className="px-1.5 rounded bg-amber-100 text-amber-800">{inj} injured</span>}
      {dead > 0 && <span className="px-1.5 rounded bg-red-100 text-red-800">{dead} killed</span>}
    </div>
  </div>
);

/**
 * Battle over: who won, both sides' tallies, then the retreat step (each
 * side moves its injured troops off the battle site — the attacker first),
 * the robber move after a won robber fight, and Close.
 */
export const BattleOutcomePanel: React.FC<BattleOutcomePanelProps> = ({
  battle,
  board,
  outcome,
  currentPlayer,
  roomId,
  robberDefeatedBy,
  moveRobberAfterWin,
  onExit,
  moverName,
  myStagedCount,
  moverTotal,
}) => {
  const phase = battle.phase;
  if ((phase !== 'repositioning' && phase !== 'finished') || !outcome) return null;
  const me = currentPlayer?.name;
  // Robber fight: show both dice; the attacker wins only on a strictly higher roll.
  const soldierRoll = battle.robberFight ? battle.states[battle.attacker]?.soldiers[0]?.rollNum ?? null : null;
  const robberRoll = battle.robberFight ? battle.states['Robber']?.soldiers[0]?.rollNum ?? null : null;
  const wonRoll = soldierRoll !== null && robberRoll !== null && soldierRoll > robberRoll;

  const retreatPending = !!moverName;
  const myRetreat = retreatPending && moverName === me;
  const iWon = !!me && outcome.winner === me;
  const iLost = !!me && !!outcome.winner && outcome.winner !== me && (me === battle.attacker || me === battle.defender);
  const headline = outcome.winner
    ? iWon
      ? 'Victory!'
      : iLost
      ? 'Defeat'
      : `${outcome.winner} wins`
    : 'No winner';
  const moved = moverTotal - myStagedCount;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={`rounded-lg px-3 py-2 text-center text-[16px] font-extrabold ${
          iWon ? 'bg-amber-400 text-amber-950' : iLost ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'
        }`}
      >
        {iWon ? '🏆 ' : ''}
        {headline}
      </div>

      {battle.robberFight ? (
        <div className="text-[13px] text-center">
          🎲 {soldierRoll} vs robber {robberRoll} — {wonRoll ? 'robber bag taken!' : 'your soldier was killed'}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Tally
            name={battle.attacker}
            alive={outcome.atkAlive}
            inj={outcome.atkInj}
            dead={outcome.atkDead}
            won={outcome.winner === battle.attacker}
          />
          <Tally
            name={battle.defender || 'Defender'}
            alive={outcome.defAlive}
            inj={outcome.defInj}
            dead={outcome.defDead}
            won={outcome.winner === battle.defender}
          />
        </div>
      )}

      {/* Retreat: injured troops must leave the battle site, attacker first. */}
      {myRetreat && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-green-900">
          <div className="text-[14px] font-bold">🩹 Retreat your injured</div>
          <div className="text-[12px] mt-0.5">
            <strong>Drag</strong> a glowing troop onto a <strong>green circle</strong> (or just click the circle).
            {myStagedCount > 1 && ' Grab any of your troops to move it first.'}
          </div>
          {moverTotal > 1 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-green-200 overflow-hidden">
                <div className="h-full bg-green-600" style={{ width: `${(moved / moverTotal) * 100}%` }} />
              </div>
              <span className="text-[11px] font-semibold">
                {moved}/{moverTotal}
              </span>
            </div>
          )}
        </div>
      )}
      {retreatPending && !myRetreat && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[13px] text-gray-600">
          Waiting for <strong>{moverName}</strong> to move their injured troops…
        </div>
      )}

      {/* After defeating the robber, the winner may move it to an adjacent hex. */}
      {robberDefeatedBy && robberDefeatedBy.playerName === me && (
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-semibold text-gray-600">Move the robber to:</div>
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
                    className="px-2 py-1 rounded-md border border-gray-300 bg-white text-[12px] hover:bg-gray-100 cursor-pointer"
                  >
                    {hex.terrain}
                    {hex.rollNumber !== null ? ` (${hex.rollNumber})` : ''}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {!retreatPending && (
        <button
          type="button"
          onClick={onExit}
          className="w-full rounded-lg py-2.5 text-[14px] font-bold bg-gray-800 text-white hover:bg-gray-900 cursor-pointer"
        >
          Close
        </button>
      )}
    </div>
  );
};
