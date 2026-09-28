import React, { useState } from 'react';
import { Board, EdgeNode, RoadPrice } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import MiniView from '../../components/MiniView';
import { useBuildRules } from './useBuildRules';
import { priceLabel } from '../../utils/price';
import { hexChipClass, panelTitleClass } from './styles';
import { ActionButton, ReasonNotice } from './ActionButton';
import { playerColorMap } from '../../utils/soldierPlacement';
import { triggerBuildAnimation } from '../../components/ResourceSpendLayer';

/**
 * Sidebar panel for a selected edge: mini view of the edge and its
 * neighborhood, road details, and the Build Road action (greyed out with a
 * reason popup when it can't be built here).
 */
const Edge: React.FC<{ board: Board; edge: EdgeNode }> = ({ board, edge }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { buildRoad } = useSocket();
  const { roadCheck } = useBuildRules(board);
  const [notice, setNotice] = useState<string | null>(null);

  const road = edge.roadId ? board.roads[edge.roadId] : null;
  const hexes = edge.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);
  const buildCheck = roadCheck(edge.id);
  const hasFreeRoad = (currentPlayer?.freeRoadsLeft ?? 0) > 0;

  const handleBuildRoad = () => {
    if (!gameRoom || !currentPlayer) return;
    buildRoad(currentPlayer.id, edge.id, gameRoom.id);
    triggerBuildAnimation({ type: 'road', locationId: edge.id });
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className={panelTitleClass}>Edge {edge.id}</h3>

      <MiniView board={board} type="edge" id={edge.id} playerColors={playerColorMap(gameRoom)} />

      <div className="text-[13px]">
        <strong>Road:</strong> {road ? `owned by ${road.ownerId}` : 'None'}
      </div>

      <div className="text-[13px]">
        <strong>Hexes:</strong>{' '}
        {hexes.map((h) => (
          <span key={h.id} className={hexChipClass}>
            {h.terrain}
            {h.rollNumber !== null ? ` (${h.rollNumber})` : ''}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <ActionButton
          label={
            <>
              Build Road{' '}
              <span className="text-xs opacity-80">
                {hasFreeRoad ? '(FREE 🛤️)' : `(${priceLabel(RoadPrice)})`}
              </span>
            </>
          }
          check={buildCheck}
          onDo={handleBuildRoad}
          onBlocked={setNotice}
        />
        {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
      </div>
    </div>
  );
};

export default Edge;
