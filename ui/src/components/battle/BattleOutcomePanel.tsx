import React from 'react';
import { BattleOutcome, BattleState, Board, Player } from 'common';
import { robberTargets } from '../../board/selectors';
import GameIcon from '../ui/GameIcon';
import Button from '../ui/Button';

interface BattleOutcomePanelProps {
  battle: BattleState;
  board: Board;
  outcome: BattleOutcome | null;
  currentPlayer: Player | null;
  robberDefeatedBy: { playerName: string; fromHexId: string } | null;
  moveRobberAfterWin: (hexId: string) => void;
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
  <div className={`rounded-lg border px-2.5 py-1.5 ${won ? 'border-gold bg-gold-pale' : 'border-ink-faint/40 bg-canvas-raised'}`}>
    <div className="flex items-center gap-1 text-[13px] font-semibold truncate">
      {won && <GameIcon name="trophy" size={13} />}
      {name}
    </div>
    <div className="flex gap-1.5 mt-1 text-[11px] font-semibold">
      <span className="px-1.5 rounded bg-moss-pale text-moss">{alive} standing</span>
      {inj > 0 && <span className="px-1.5 rounded bg-gold-pale text-gold-deep">{inj} injured</span>}
      {dead > 0 && <span className="px-1.5 rounded bg-clay-pale text-clay">{dead} killed</span>}
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
          iWon ? 'bg-gold-soft text-ink' : iLost ? 'bg-ink-soft text-white' : 'bg-canvas-sunken text-ink'
        }`}
      >
        {iWon && <GameIcon name="trophy" size={15} className="inline -mt-0.5" />}{' '}
        {headline}
      </div>

      {battle.forfeitedBy && (
        <div className="text-[12px] text-center text-ink-faint">
          <GameIcon name="capture" size={12} className="inline -mt-0.5" /> {battle.forfeitedBy === me ? 'You' : battle.forfeitedBy} fled — the battle counts as a loss
        </div>
      )}

      {battle.robberFight ? (
        <div className="text-[13px] text-center">
          <GameIcon name="dice" size={13} className="inline -mt-0.5" /> {soldierRoll} vs robber {robberRoll} — {wonRoll ? 'robber bag taken!' : 'your soldier was killed'}
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
        <div className="rounded-lg border-2 border-moss bg-moss-pale px-3 py-2 text-moss">
          <div className="text-[14px] font-bold"><GameIcon name="heal" size={14} className="inline -mt-0.5" /> Retreat your injured</div>
          <div className="text-[12px] mt-0.5">
            <strong>Drag</strong> a glowing troop onto a <strong>green circle</strong> (or just click the circle).
            {myStagedCount > 1 && ' Grab any of your troops to move it first.'}
          </div>
          {moverTotal > 1 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-moss-soft/40 overflow-hidden">
                <div className="h-full bg-moss" style={{ width: `${(moved / moverTotal) * 100}%` }} />
              </div>
              <span className="text-[11px] font-semibold">
                {moved}/{moverTotal}
              </span>
            </div>
          )}
        </div>
      )}
      {retreatPending && !myRetreat && (
        <div className="rounded-lg bg-canvas-sunken border border-ink-faint/40 px-3 py-2 text-[13px] text-ink-soft">
          Waiting for <strong>{moverName}</strong> to move their injured troops…
        </div>
      )}

      {/* After defeating the robber, the winner may move it to an adjacent hex. */}
      {robberDefeatedBy && robberDefeatedBy.playerName === me && (
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-semibold text-ink-soft">Move the robber to:</div>
          <div className="flex flex-wrap gap-1">
            {robberTargets(board, robberDefeatedBy.fromHexId).map((hexId) => {
              const hex = board.hexes[hexId];
              return (
                <Button
                  key={hexId}
                  size="sm"
                  onClick={() => moveRobberAfterWin(hexId)}
                >
                  {hex.terrain}
                  {hex.rollNumber !== null ? ` (${hex.rollNumber})` : ''}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {!retreatPending && (
        <Button
          variant="unstyled"
          onClick={onExit}
          className="w-full rounded-lg py-2.5 text-[14px] font-bold bg-ink text-white hover:bg-ink-soft"
        >
          Close
        </Button>
      )}
    </div>
  );
};
