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
  FALLBACK_OWNER_COLOR,
  layoutSide,
} from '../utils/battleModal';
import { BattleArmies } from '../components/battle/BattleArmies';
import { BattleOutcomePanel } from '../components/battle/BattleOutcomePanel';
import { BattleStepper } from '../components/battle/BattleStepper';
import { BetweenRoundsControls } from '../components/battle/BetweenRoundsControls';
import { DiceMatchupPanel } from '../components/battle/DiceMatchupPanel';
import { RepositionOverlay } from '../components/battle/RepositionOverlay';
import { RollingPrompt } from '../components/battle/RollingPrompt';
import { BATTLE_MINI_MIN_VIEW_SIZE } from '../components/battle/constants';

/** A player name with their color dot, for the battle header. */
const SideName: React.FC<{ name: string; color?: string; you: boolean; align?: 'left' | 'right' }> = ({
  name,
  color,
  you,
  align = 'left',
}) => (
  <span className={`flex items-center gap-1.5 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10" style={{ background: color ?? FALLBACK_OWNER_COLOR }} />
    <span className="truncate">
      {name}
      {you && <span className="text-gray-400 font-normal"> (you)</span>}
    </span>
  </span>
);

/**
 * The battle window: a full-screen view that opens for ALL players as soon as
 * a battle is in progress. A progress bar (Roll → Result → Retreat → Done)
 * runs across the top; the battle vertex's mini-map is the arena, with the two
 * armies on opposite sides — each soldier advances to the center "clash line"
 * with its die shown as it rolls. The side panel holds what to do now. After
 * the fight, injured survivors retreat right on the map: your next troop is
 * picked for you, arrows point to where it can go, and moving your last one
 * finishes your turn.
 */
const BattleModal: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { rollBattleDie, continueBattle, endBattle, exitBattle, repositionSoldier, finishRepositioning, moveRobberAfterWin } =
    useSocket();

  const battle = gameRoom?.battleState ?? null;
  const board = gameRoom?.board ?? null;
  // The troop whose roll is in flight (clicked, awaiting the result) —
  // gives instant feedback so the click doesn't feel dead.
  const [rollingSoldierId, setRollingSoldierId] = useState<string | null>(null);

  // Hooks must run unconditionally, before the early return below.
  const reposition = useBattleReposition({
    board,
    battle,
    currentPlayer,
    roomId: gameRoom?.id,
    repositionSoldier,
    finishRepositioning,
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
  const me = currentPlayer?.name;

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
    rollBattleDie(soldierId, gameRoom.id);
  };

  const canRoll = (s: SoldierBattleState): boolean => canRollSoldier(battle, s, phase, me);
  const myRollPending = Object.values(battle.states).some((side) => side.soldiers.some(canRoll));

  const canContinue = currentPlayer !== null && battle.attacker === me && phase === 'betweenRounds';

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

  // Retreat bookkeeping for the progress bar and the "2/3 moved" meter.
  const { moverName, myStagedCount, selectedTroop, validTargets, stagedTroops, placedTroops } = reposition;
  const moverTotal = moverName
    ? [...stagedTroops, ...placedTroops].filter((t) => t.ownerName === moverName).length
    : 0;
  const pickableIds = new Set(
    reposition.isMyRepositionTurn ? stagedTroops.filter((t) => t.ownerName === me).map((t) => t.soldierId) : []
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      {/* Fixed to the viewport height: the map shrinks to fit, never scrolls. */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[860px] p-4 flex flex-col gap-3 overflow-hidden">
        {/* Header: attacker vs defender, plus where the battle stands. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
          <h2 className="m-0 flex items-center gap-2 text-lg font-bold min-w-0">
            <SideName name={battle.attacker} color={colors[battle.attacker]} you={battle.attacker === me} />
            <span className="text-gray-400 font-normal text-[14px]">⚔️</span>
            <SideName
              name={battle.defender || 'Defender'}
              color={colors[battle.defender]}
              you={battle.defender === me}
              align="right"
            />
          </h2>
          {!battle.robberFight && <BattleStepper phase={phase} retreatPending={!!moverName} round={battle.round} />}
        </div>
        <div className="flex-1 min-h-0 flex gap-4">
          {/* The arena: the vertex mini-map with both armies on it, or (when
              repositioning) the injured troops and where they can retreat. */}
          <div className="flex-1 min-w-0 min-h-0">
            {vertex && (
              <MiniView
                board={board}
                type="vertex"
                id={battle.vertexId}
                playerColors={colors}
                showGarrisonedSoldiers={false}
                svgRef={reposition.svgRef}
                {...(phase === 'repositioning' ? reposition.svgHandlers : {})}
                minViewSize={BATTLE_MINI_MIN_VIEW_SIZE}
                className="h-full w-full"
              >
                {phase === 'repositioning' ? (
                  <RepositionOverlay
                    board={board}
                    battleVertexId={battle.vertexId}
                    stagedTroops={stagedTroops}
                    placedTroops={placedTroops}
                    selectedId={selectedTroop?.soldierId ?? null}
                    targets={validTargets}
                    pickableIds={pickableIds}
                    colors={colors}
                    drag={reposition.drag}
                    onTroopPress={reposition.startTroopPress}
                    onAssign={reposition.assignTo}
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

          {/* Side panel: what to do right now. */}
          <div className="w-72 shrink-0 flex flex-col gap-3 min-h-0 overflow-y-auto">
            {phase === 'rolling' && (
              <RollingPrompt waitingLines={waitingLines} rolling={rollingSoldierId !== null} myRollPending={myRollPending} />
            )}

            {(phase === 'betweenRounds' || phase === 'finished' || (phase === 'repositioning' && !battle.robberFight)) && (
              <DiceMatchupPanel matchup={matchup} attacker={battle.attacker} defender={battle.defender} />
            )}

            <BetweenRoundsControls
              battle={battle}
              canContinue={canContinue}
              attackerAlive={attackerAlive}
              defenderAlive={defenderAlive}
              onContinue={() => currentPlayer && continueBattle(gameRoom.id)}
              onEnd={() => currentPlayer && endBattle(gameRoom.id)}
            />
            <BattleOutcomePanel
              battle={battle}
              board={board}
              outcome={outcome}
              currentPlayer={currentPlayer}
              roomId={gameRoom.id}
              robberDefeatedBy={gameRoom.robberDefeatedBy}
              moveRobberAfterWin={moveRobberAfterWin}
              onExit={() => exitBattle(gameRoom.id)}
              moverName={moverName}
              myStagedCount={myStagedCount}
              moverTotal={moverTotal}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleModal;
