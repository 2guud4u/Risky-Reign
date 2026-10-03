import { Board, BuildCheck, CityPrice, Price, SettlementPrice, SoldierPrice, VertexNode } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { triggerBuildAnimation } from '../components/ResourceSpendLayer';
import { useBuildRules } from './useBuildRules';

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

  return [
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
    },
    {
      key: 'soldier',
      label: 'Recruit Soldier',
      price: SoldierPrice,
      check: soldierCheck(vertex.id),
      run: send(recruitSoldier, 'soldier'),
    },
  ];
}
