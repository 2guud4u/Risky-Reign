import { useEffect } from 'react';
import { useGameActions, useGameState, useSelection } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import { useSetupCoach } from '../../hooks/useSetupCoach';
import { actableSoldierIds } from '../selectors';
import { BubbleAction } from '../../components/board/ActionBubbles';
import {
  BoardActionEmit,
  BoardActionsInput,
  resolveSelection,
} from './types';
import { makeRules } from './rules';
import { vertexBuildActions, edgeBuildActions } from './build';
import { soldierActions } from './soldier';
import { robberActions } from './robber';
import { shipActions } from './ship';

export type { BoardActionEmit, BoardActionsInput } from './types';
export { resolveSelection } from './types';
export { nothingBuildable } from './rules';

/**
 * The one action catalog: every bubble a selection can show, produced as
 * `BubbleAction` descriptors for `ActionBubbles`. All gates live here — the
 * spectate/selection gate (via `useBoardActions`), the per-action phase
 * checks, and the shared rule checks — so the descriptor is the single
 * source of truth for what's offered, greyed, or hidden.
 */
export function boardActions(input: BoardActionsInput): BubbleAction[] {
  const { board, room, me, selection } = input;
  const rules = makeRules(room, board, me);
  const selected = resolveSelection(board, selection);
  if (!selected) return [];

  if (selected.kind === 'vertex') {
    const vertex = selected.vertex;
    const actableIds = actableSoldierIds(room, me.name, vertex.id);
    return [
      ...vertexBuildActions(input, vertex, rules),
      ...soldierActions(input, vertex, rules, actableIds),
    ];
  }
  if (selected.kind === 'edge') {
    return edgeBuildActions(input, selected.edge, rules);
  }
  if (selected.kind === 'ship') {
    const ship = selected.ship;
    const vertex = board.vertices[ship.vertexId];
    const actableIds = vertex ? actableSoldierIds(room, me.name, vertex.id) : [];
    return [
      ...shipActions(input, ship, rules),
      // Aboard troops act from the ship's vertex (station/fire/splash etc.).
      ...(vertex && (room.cannonsEnabled || room.shipsEnabled)
        ? soldierActions(input, vertex, rules, actableIds)
        : []),
    ];
  }
  return robberActions(input, selected.robberHexId, rules);
}

/**
 * The hook form of `boardActions`: wires the contexts, owns the "a newly
 * selected vertex starts with every actable soldier picked" effect, and
 * reports the `resetKey` (selection identity) that collapses an expanded
 * bubble when the selection changes. Returns null when there is nothing to
 * show — no room/board, spectating, or a stale selection.
 */
export function useBoardActions(): { actions: BubbleAction[]; resetKey: string } | null {
  const { gameRoom, currentPlayer } = useGameState();
  const { selectedObject, selectedSoldierIds } = useSelection();
  const { setSelectedSoldierIds, setSailingShipId } = useGameActions();
  const socket = useSocket();
  const coach = useSetupCoach(gameRoom?.board ?? null);

  // The vertex whose soldiers pre-pick on selection: the clicked vertex, or
  // the vertex a selected ship sits on (its troops act from there).
  const vertexId =
    selectedObject?.type === 'vertex'
      ? selectedObject.id
      : selectedObject?.type === 'ship'
        ? (gameRoom?.board?.ships[selectedObject.id]?.vertexId ?? null)
        : null;
  const actableIds = actableSoldierIds(gameRoom, currentPlayer?.name, vertexId);
  const canPick = actableIds.length > 0;

  // A newly selected vertex starts with every soldier that can act picked;
  // leaving it (or the Action phase ending) drops the picks.
  useEffect(() => {
    if (!vertexId || !currentPlayer) return;
    setSelectedSoldierIds(actableIds);
    return () => setSelectedSoldierIds([]);
    // The picks belong to the vertex + whether any soldier is pickable, not
    // to the changing actableIds array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertexId, canPick]);

  if (!gameRoom?.board || !currentPlayer || !selectedObject) return null;
  const board = gameRoom.board;
  const selected = resolveSelection(board, selectedObject);
  if (!selected) return null;

  const emit: BoardActionEmit = {
    buildSettlement: socket.buildSettlement,
    buildRoad: socket.buildRoad,
    upgradeSettlementToCity: socket.upgradeSettlementToCity,
    recruitSoldier: socket.recruitSoldier,
    moveSoldier: socket.moveSoldier,
    healSoldier: socket.healSoldier,
    startAttack: socket.startAttack,
    captureSettlement: socket.captureSettlement,
    fightRobber: socket.fightRobber,
    moveRobberAfterWin: socket.moveRobberAfterWin,
    playDevelopmentCard: socket.playDevelopmentCard,
    chooseKnightEffect: socket.chooseKnightEffect,
    knightSpawnSoldier: socket.knightSpawnSoldier,
    setSelectedSoldierIds,
    upgradeCannon: socket.upgradeCannon,
    downgradeCannon: socket.downgradeCannon,
    stationCannon: socket.stationCannon,
    unstationCannon: socket.unstationCannon,
    cannonAttack: socket.cannonAttack,
    cannonSplash: socket.cannonSplash,
    cannonAttackWall: socket.cannonAttackWall,
    upgradeRoadToWall: socket.upgradeRoadToWall,
    buildShip: socket.buildShip,
    moveShip: socket.moveShip,
    embarkSoldier: socket.embarkSoldier,
    disembarkSoldier: socket.disembarkSoldier,
    convertShipToSettlement: socket.convertShipToSettlement,
    setSailingShipId,
  };
  const actions = boardActions({
    board,
    room: gameRoom,
    me: currentPlayer,
    selection: selectedObject,
    selectedSoldierIds,
    coachKey: coach?.key ?? null,
    emit,
  });
  const resetKey =
    selected.kind === 'robber' ? `robber-${selected.robberHexId}` : selectedObject.id;
  return { actions, resetKey };
}
