import React, { useEffect, useState } from 'react';
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
  // The troop whose roll is in flight (clicked, awaiting the result) —
  // gives instant feedback so the click doesn't feel dead.
  const [rollingSoldierId, setRollingSoldierId] = useState<string | null>(null);

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
  // Clear the pending-roll marker once the result arrives (the troop has a
  // rollNum) or the phase is no longer 'rolling' — the '…' must not linger.
  useEffect(() => {
    if (!battle || battle.phase !== 'rolling') {
      setRollingSoldierId(null);
      return;
    }
    const s = Object.values(battle.states)
      .flatMap((side) => side.soldiers)
      .find((x) => x.soldier.id === rollingSoldierId);
    if (!s || s.rollNum !== null) setRollingSoldierId(null);
  }, [battle, rollingSoldierId]);
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
    setRollingSoldierId(soldierId);
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
      {/* Fixed to the viewport height: the map shrinks to fit, never scrolls. */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[860px] p-4 flex flex-col gap-3 overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 shrink-0">
          <h2 className="m-0 text-lg font-bold truncate">
            ⚔ {battle.attacker} <span className="text-gray-400 font-normal">vs</span>{' '}
            {battle.defender || 'Defender'}
          </h2>
          <span className="text-[13px] text-gray-500 shrink-0">Round {battle.round}</span>
        </div>
        <div className="flex-1 min-h-0 flex gap-4">
          {/* The arena: the vertex mini-map with both armies on it, or (when
              repositioning) lit targets for the selected injured troop. */}
          <div className="flex-1 min-w-0 min-h-0">
            {vertex && (
              <MiniView
                board={board}
                type="vertex"
                id={battle.vertexId}
                playerColors={colors}
                showGarrisonedSoldiers={false}
                svgRef={svgRef}
                minViewSize={BATTLE_MINI_MIN_VIEW_SIZE}
                className="h-full w-full"
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
                    rollingSoldierId={rollingSoldierId}
                    colors={colors}
                    onRoll={handleRoll}
                  />
                )}
              </MiniView>
            )}
          </div>

          {/* Side panel: status and controls for the current phase. */}
          <div className="w-64 shrink-0 flex flex-col gap-3 min-h-0 overflow-y-auto">
            {phase === 'rolling' && <RollingPrompt waitingLines={waitingLines} rolling={rollingSoldierId !== null} />}

            {(phase === 'betweenRounds' || phase === 'finished') && <DiceMatchupPanel matchup={matchup} />}

            <BetweenRoundsControls
              battle={battle}
              canContinue={canContinue}
              attackerAlive={attackerAlive}
              defenderAlive={defenderAlive}
              onContinue={handleContinue}
              onEnd={handleEnd}
            />
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
            >
              <RepositionRail
                stagedTroops={stagedTroops}
                selectedSoldierId={selected?.soldierId ?? null}
                selectedTargetCount={selected?.validTargets.length ?? 0}
                currentPlayerName={currentPlayer?.name}
                colors={colors}
                isMyRepositionTurn={isMyRepositionTurn()}
                onSelect={selectTroop}
              />
            </BattleOutcomePanel>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleModal;
