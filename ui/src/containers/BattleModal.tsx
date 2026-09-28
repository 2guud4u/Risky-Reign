import React from 'react';
import { SoldierBattleState } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import MiniView from '../components/MiniView';
import { playerColorMap } from '../utils/soldierPlacement';
import { useBattleReposition } from '../hooks/useBattleReposition';
import {
  canRollSoldier,
  clashLineSpread,
  computeBattleOutcome,
  computeDiceMatchup,
  computeWaitingLines,
  layoutSide,
} from '../utils/battleModal';
import { BattleArmies } from '../components/battle/BattleArmies';
import { BattleOutcomePanel } from '../components/battle/BattleOutcomePanel';
import { BetweenRoundsControls } from '../components/battle/BetweenRoundsControls';
import { DiceMatchupPanel } from '../components/battle/DiceMatchupPanel';
import { RepositionOverlay } from '../components/battle/RepositionOverlay';
import { RepositionRail } from '../components/battle/RepositionRail';
import { RollingPrompt } from '../components/battle/RollingPrompt';
import { BATTLE_MINI_MIN_VIEW_SIZE } from '../components/battle/constants';

/**
 * The battle window: a separate full-screen view that opens for ALL players as
 * soon as a battle is in progress. A mini-map of the battle vertex sits in the
 * middle; the two armies are drawn on it on OPPOSITE sides, and as each
 * soldier rolls its die it advances to the center "clash line" and lines up
 * with its die shown. The attacker drives the battle: continue to roll another
 * round while the defender still has troops, or end it once they are wiped out.
 */

const BattleModal: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { rollBattleDie, continueBattle, endBattle, exitBattle, repositionSoldier, finishRepositioning, moveRobberAfterWin } = useSocket();

  const battle = gameRoom?.battleState ?? null;
  const board = gameRoom?.board ?? null;

  // Hooks must run unconditionally, before the early return below.
  const {
    svgRef,
    stagedTroops,
    placedTroops,
    selected,
    selectTroop,
    assignTo,
    isMyRepositionTurn,
  } = useBattleReposition({
    board,
    battle,
    currentPlayer,
    roomId: gameRoom?.id,
    repositionSoldier,
  });

  if (!gameRoom || !battle || !board) return null;

  const vertex = board.vertices[battle.vertexId];
  const center = vertex ? vertex.position : { x: 0, y: 0 };
  const colors = playerColorMap(gameRoom);

  const attackerSide = battle.states[battle.attacker] ?? { soldiers: [] };
  const defenderSide =
    battle.defender && battle.states[battle.defender] ? battle.states[battle.defender] : { soldiers: [] };

  const phase = battle.phase;

  const handleRoll = (soldierId: string) => {
    if (!currentPlayer || phase !== 'rolling') return;
    const committed = Object.values(battle.states).some((side) =>
      side.soldiers.some((s) => s.soldier.id === soldierId)
    );
    if (!committed) return;
    rollBattleDie(currentPlayer.id, soldierId, gameRoom.id);
  };

  const canRoll = (s: SoldierBattleState): boolean =>
    canRollSoldier(battle, s, phase, currentPlayer?.name);

  const canContinue =
    currentPlayer !== null &&
    battle.attacker === currentPlayer.name &&
    phase === 'betweenRounds';

  const handleContinue = () => {
    if (!currentPlayer) return;
    continueBattle(currentPlayer.id, gameRoom.id);
  };

  // The attacker may end the battle at their choosing after a resolved round.
  const handleEnd = () => {
    if (!currentPlayer) return;
    endBattle(currentPlayer.id, gameRoom.id);
  };

  const handleExit = () => {
    exitBattle(gameRoom.id);
  };

  // A side is "still in the fight" only while it has a living, uninjured troop
  // (injured troops are out of the fight, Rule 28).
  const defenderAlive = defenderSide.soldiers.some((s) => !s.dead && !s.injured);
  const attackerAlive = attackerSide.soldiers.some((s) => !s.dead && !s.injured);

  const outcome = computeBattleOutcome(battle, attackerSide.soldiers, defenderSide.soldiers, phase);

  // During 'betweenRounds' this round's casualties are hidden (pending), so
  // every troop that rolled is still on the clash line.
  const attackerSlots = layoutSide(center, attackerSide.soldiers, true, phase, false);
  const defenderSlots = layoutSide(center, defenderSide.soldiers, false, phase, !!battle.injuredFight);
  const troopSpread = clashLineSpread(battle, phase);

  const waitingLines = computeWaitingLines(battle, phase);
  const matchup = computeDiceMatchup(battle, attackerSide.soldiers, defenderSide.soldiers, phase);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl p-5 flex flex-col gap-3 max-h-[94vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-xl font-bold">⚔ Battle</h2>
          <span className="text-[13px] text-gray-500">Round {battle.round}</span>
        </div>
        {/* The battle arena: the vertex mini-map with both armies on it. In the
            repositioning phase it instead shows a left staging rail of injured
            troops; the active player picks one and clicks a lit vertex to
            place it (placed troops stack on the vertex). */}
        {vertex && (
          <div className="flex items-stretch gap-3">
            {phase === 'repositioning' && (
              <RepositionRail
                stagedTroops={stagedTroops}
                selectedSoldierId={selected?.soldierId ?? null}
                selectedTargetCount={selected?.validTargets.length ?? 0}
                currentPlayerName={currentPlayer?.name}
                colors={colors}
                isMyRepositionTurn={isMyRepositionTurn()}
                onSelect={selectTroop}
              />
            )}
            <div className="flex-1 min-w-0">
              <MiniView
                board={board}
                type="vertex"
                id={battle.vertexId}
                playerColors={colors}
                showGarrisonedSoldiers={false}
                svgRef={svgRef}
                minViewSize={BATTLE_MINI_MIN_VIEW_SIZE}
              >
                {phase === 'repositioning' ? (
                  <RepositionOverlay
                    board={board}
                    placedTroops={placedTroops}
                    selectedTargets={selected?.validTargets ?? []}
                    currentPlayerName={currentPlayer?.name}
                    colors={colors}
                    onAssign={assignTo}
                  />
                ) : (
                  <BattleArmies
                    center={center}
                    phase={phase}
                    attackerSlots={attackerSlots}
                    defenderSlots={defenderSlots}
                    troopSpread={troopSpread}
                    canRoll={canRoll}
                    colors={colors}
                    onRoll={handleRoll}
                  />
                )}
              </MiniView>
            </div>
          </div>
        )}
        {/* Attacker vs defender (no location link — the mini-map shows it). */}
        <div className="text-[13px] text-gray-700">
          <strong>{battle.attacker}</strong> attacks <strong>{battle.defender || 'the defender'}</strong>
        </div>

        {/* Rolling phase: players roll their own dice, one per troop. */}
        {phase === 'rolling' && <RollingPrompt waitingLines={waitingLines} />}

        {/* Between rounds / finished: show how the dice compared. */}
        {(phase === 'betweenRounds' || phase === 'finished') && (
          <DiceMatchupPanel round={battle.round} matchup={matchup} attacker={battle.attacker} defender={battle.defender} />
        )}

        {/* Battle over: show the outcome and let players exit. In the
            repositioning phase the window stays open so owners can drag their
            injured troops to a neighboring vertex (or leave them in place). */}
        <BattleOutcomePanel
          battle={battle}
          board={board}
          outcome={outcome}
          currentPlayer={currentPlayer}
          roomId={gameRoom.id}
          robberDefeatedBy={gameRoom.robberDefeatedBy}
          finishRepositioning={finishRepositioning}
          moveRobberAfterWin={moveRobberAfterWin}
          onExit={handleExit}
        />

        {/* Between rounds only: let the attacker continue or end at their choosing. */}
        <BetweenRoundsControls
          battle={battle}
          canContinue={canContinue}
          attackerAlive={attackerAlive}
          defenderAlive={defenderAlive}
          currentPlayer={currentPlayer}
          onContinue={handleContinue}
          onEnd={handleEnd}
        />
      </div>
    </div>
  );
};

export default BattleModal;
