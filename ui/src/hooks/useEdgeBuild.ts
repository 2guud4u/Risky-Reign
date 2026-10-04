import { Board, BuildCheck, EdgeNode, RoadPrice } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { triggerBuildAnimation } from '../components/ResourceSpendLayer';
import { useBuildRules } from './useBuildRules';
import { priceLabel } from '../utils/price';

/** The Build Road action for an edge. */
export interface EdgeBuildAction {
  label: string;
  /** Cost text: the road price, or "FREE 🛤️" with a Road Building card. */
  costText: string;
  /** The backend's own rule check: allowed, or the reason it isn't. */
  check: BuildCheck;
  run: () => void;
}

/**
 * Build Road for an edge, with its rule check and handler (used by the on-map
 * 🔨 bubble).
 */
export function useEdgeBuild(board: Board, edge: EdgeNode): EdgeBuildAction {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { buildRoad } = useSocket();
  const { roadCheck } = useBuildRules(board);
  const hasFreeRoad = (currentPlayer?.freeRoadsLeft ?? 0) > 0;
  const setup = gameRoom?.turnState.phase === 'SetUp';

  return {
    label: 'Build Road',
    costText: setup ? 'Free' : hasFreeRoad ? 'FREE 🛤️' : priceLabel(RoadPrice),
    check: roadCheck(edge.id),
    run: () => {
      if (!gameRoom || !currentPlayer) return;
      buildRoad(currentPlayer.id, edge.id, gameRoom.id);
      // A free (Road Building) road spends nothing, so nothing flies.
      if (!hasFreeRoad) triggerBuildAnimation({ type: 'road', locationId: edge.id });
    },
  };
}
