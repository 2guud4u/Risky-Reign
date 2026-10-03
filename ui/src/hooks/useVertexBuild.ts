import { Board, BuildCheck, CityPrice, Price, SettlementPrice, SoldierPrice, VertexNode } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { triggerBuildAnimation } from '../components/ResourceSpendLayer';
import { actableSoldierIds } from '../utils/soldierActions';
import { useBuildRules } from './useBuildRules';
import type { BubbleAction } from '../components/board/ActionBubbles';

/** One build action available on a vertex. */
export interface VertexBuildAction {
  key: 'settlement' | 'city' | 'soldier';
  label: string;
  price: Price;
  /** The backend's own rule check: allowed, or the reason it isn't. */
  check: BuildCheck;
  run: () => void;
}

/**
 * Select/deselect every soldier that can act on the selected vertex, shown
 * only during the Action phase.
 */
export function useVertexSoldierSelectAll(board: Board, vertex: VertexNode): BubbleAction | null {
  const { gameRoom, currentPlayer, selectedSoldierIds, setSelectedSoldierIds } = useGameRoom();
  const actableIds = actableSoldierIds(gameRoom, currentPlayer?.name, vertex.id);
  if (gameRoom?.turnState.phase !== 'Action') return null;
  const picked = selectedSoldierIds.filter((id) => actableIds.includes(id));
  const allSelected = picked.length > 0 && picked.length === actableIds.length;
  return {
    key: 'toggle-select-all-soldiers',
    icon: '👥',
    label: allSelected ? 'Deselect All Soldiers' : 'Select All Soldiers',
    costText: `${actableIds.length} soldier${actableIds.length === 1 ? '' : 's'}`,
    check: { allowed: true, reason: null },
    run: () => setSelectedSoldierIds(allSelected ? [] : actableIds),
  };
}

/**
 * The build actions for a vertex — build settlement, upgrade to city, recruit
 * soldier — with their rule checks and handlers (used by the on-map action
 * bubbles).
 */
export function useVertexBuild(board: Board, vertex: VertexNode): VertexBuildAction[] {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { buildSettlement, upgradeSettlementToCity, recruitSoldier } = useSocket();
  const { settlementCheck, cityCheck, soldierCheck } = useBuildRules(board);

  const send = (emit: (playerId: string, vertexId: string, roomId: string) => void, type: VertexBuildAction['key']) => () => {
    if (!gameRoom || !currentPlayer) return;
    emit(currentPlayer.id, vertex.id, gameRoom.id);
    triggerBuildAnimation({ type, locationId: vertex.id });
  };

  const phase = gameRoom?.turnState.phase;
  const actions: VertexBuildAction[] = [];

  // Buildings exist only in the SetUp/Build phases; the Action phase has no
  // build bubbles at all (recruit soldier below is the exception).
  if (phase === 'SetUp' || phase === 'Build') {
    actions.push(
      {
        key: 'settlement',
        label: 'Build Settlement',
        price: SettlementPrice,
        check: settlementCheck(vertex.id),
        run: send(buildSettlement, 'settlement'),
      },
      {
        key: 'city',
        label: 'Upgrade to City',
        price: CityPrice,
        check: cityCheck(vertex.id),
        run: send(upgradeSettlementToCity, 'city'),
      }
    );
  }

  // Soldiers are recruited only in the Action phase; hide the bubble otherwise.
  if (gameRoom?.turnState.phase === 'Action') {
    actions.push({
      key: 'soldier',
      label: 'Recruit Soldier',
      price: SoldierPrice,
      check: soldierCheck(vertex.id),
      run: send(recruitSoldier, 'soldier'),
    });
  }

  return actions;
}
