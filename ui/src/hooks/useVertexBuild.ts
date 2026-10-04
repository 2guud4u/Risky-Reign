import { Board, BuildCheck, CityPrice, Price, SettlementPrice, SoldierPrice, VertexNode, canKnightSpawnAt } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { triggerBuildAnimation } from '../components/ResourceSpendLayer';
import { actableSoldierIds } from '../utils/soldierActions';
import { useBuildRules } from './useBuildRules';
import { emptyPrice } from '../constants';
import type { BubbleAction } from '../components/board/ActionBubbles';

/** One build action available on a vertex. */
export interface VertexBuildAction {
  key: 'settlement' | 'city' | 'soldier' | 'knight';
  label: string;
  price: Price;
  /** The backend's own rule check: allowed, or the reason it isn't. */
  check: BuildCheck;
  run: () => void;
}

/**
 * Select/deselect every soldier that can act on the selected vertex, shown
 * only during the Action phase when there is more than one to pick. A plain
 * toggle, so it acts on the first click (no expand/confirm step).
 */
export function useVertexSoldierSelectAll(board: Board, vertex: VertexNode): BubbleAction | null {
  const { gameRoom, currentPlayer, selectedSoldierIds, setSelectedSoldierIds } = useGameRoom();
  const actableIds = actableSoldierIds(gameRoom, currentPlayer?.name, vertex.id);
  if (gameRoom?.turnState.phase !== 'Action' || actableIds.length < 2) return null;
  const picked = selectedSoldierIds.filter((id) => actableIds.includes(id));
  const allSelected = picked.length === actableIds.length;
  return {
    key: 'toggle-select-all-soldiers',
    icon: allSelected ? '👤' : '👥',
    label: allSelected ? 'Pick none' : `Pick all ${actableIds.length}`,
    costText: '',
    check: { allowed: true, reason: null },
    run: () => setSelectedSoldierIds(allSelected ? [] : actableIds),
    instant: true,
  };
}

/**
 * The build actions for a vertex — build settlement, upgrade to city, recruit
 * soldier, or (while a played Knight awaits its spawn) spawn the knight's
 * free soldier — with their rule checks and handlers (used by the on-map
 * action bubbles).
 */
export function useVertexBuild(board: Board, vertex: VertexNode): VertexBuildAction[] {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { buildSettlement, upgradeSettlementToCity, recruitSoldier, knightSpawnSoldier } = useSocket();
  const { settlementCheck, cityCheck, soldierCheck } = useBuildRules(board);

  const send = (emit: (playerId: string, vertexId: string, roomId: string) => void, type: Exclude<VertexBuildAction['key'], 'knight'>) => () => {
    if (!gameRoom || !currentPlayer) return;
    emit(currentPlayer.id, vertex.id, gameRoom.id);
    triggerBuildAnimation({ type, locationId: vertex.id });
  };

  const phase = gameRoom?.turnState.phase;
  const actions: VertexBuildAction[] = [];

  // A played Knight waiting for its spawn: offer it on this vertex.
  const choice = gameRoom?.devCardChoice;
  if (gameRoom && currentPlayer && choice?.card === 'knight' && choice.spawn && choice.player === currentPlayer.name) {
    actions.push({
      key: 'knight',
      label: 'Knight: Spawn Soldier',
      price: emptyPrice,
      check: canKnightSpawnAt(board, currentPlayer.name, vertex.id),
      run: () => knightSpawnSoldier(gameRoom.id, vertex.id),
    });
  }

  // Only offer what can apply to this corner at all: Build Settlement on an
  // empty corner, Upgrade to City on my own settlement (Build phase only),
  // Recruit Soldier on my own settlement or city (Action phase only). A bubble
  // that is shown can still be greyed — not enough cards, distance rule, piece
  // limit — and expanding it shows why.
  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  const mine = !!settlement && settlement.ownerId === currentPlayer?.name;
  if ((phase === 'SetUp' || phase === 'Build') && !settlement) {
    actions.push({
      key: 'settlement',
      label: 'Build Settlement',
      price: SettlementPrice,
      check: settlementCheck(vertex.id),
      run: send(buildSettlement, 'settlement'),
    });
  }
  if (phase === 'Build' && mine && settlement.level === 'settlement') {
    actions.push({
      key: 'city',
      label: 'Upgrade to City',
      price: CityPrice,
      check: cityCheck(vertex.id),
      run: send(upgradeSettlementToCity, 'city'),
    });
  }
  if (phase === 'Action' && mine) {
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
