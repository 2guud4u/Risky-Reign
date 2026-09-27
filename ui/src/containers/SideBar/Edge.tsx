import React from 'react';
import { Board, EdgeNode, RoadPrice } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import MiniView from '../../components/MiniView';
import { useBuildRules } from './useBuildRules';
import { priceLabel } from '../../utils/price';
import { buildButtonClass, hexChipClass, panelTitleClass, sectionTitleClass } from './styles';
import { playerColorMap } from '../../utils/soldierPlacement';
import { triggerBuildAnimation } from '../../components/ResourceSpendLayer';

/**
 * Sidebar panel for a selected edge: mini view of the edge and its
 * neighborhood, road details, the Build Road action, and the two endpoint
 * vertices (clickable to inspect them).
 */
const Edge: React.FC<{ board: Board; edge: EdgeNode }> = ({ board, edge }) => {
  const { gameRoom, currentPlayer, setSelectedObject } = useGameRoom();
  const { buildRoad } = useSocket();
  const { canBuildRoadOn } = useBuildRules(board);

  const road = edge.roadId ? board.roads[edge.roadId] : null;
  const hexes = edge.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);
  const canBuildRoad = canBuildRoadOn(edge.id);
  const hasFreeRoad = (currentPlayer?.freeRoadsLeft ?? 0) > 0;

  const endpoints = [edge.vertexAId, edge.vertexBId].map((vid) => {
    const vertex = board.vertices[vid];
    const settlement = vertex?.settlementId ? board.settlements[vertex.settlementId] : null;
    return { vertex, settlement };
  });

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

      {canBuildRoad && (
        <button
          onClick={handleBuildRoad}
          className={buildButtonClass}
          title={hasFreeRoad ? 'Build road (FREE — Road Building card)' : `Build road (${priceLabel(RoadPrice)})`}
        >
          Build Road{' '}
          <span className="text-white text-xs">
            {hasFreeRoad ? '(FREE 🛤️)' : `(${priceLabel(RoadPrice)})`}
          </span>
        </button>
      )}

      <div>
        <div className={`${sectionTitleClass} mb-1.5`}>Endpoints</div>
        <div className="flex flex-col gap-1.5">
          {endpoints.map(({ vertex, settlement }) =>
            vertex ? (
              <button
                key={vertex.id}
                onClick={() => setSelectedObject({ type: 'vertex', id: vertex.id })}
                className="text-left border border-gray-200 rounded-md p-2 text-xs hover:bg-gray-50 cursor-pointer"
                title="Show this vertex"
              >
                <span className="text-gray-600">vertex </span>
                <strong>{vertex.id}</strong>
                {settlement && (
                  <span className="text-[#8B4513]">
                    {' '}
                    — {settlement.level === 'city' ? 'City' : 'Settlement'} ({settlement.ownerId})
                  </span>
                )}
              </button>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
};

export default Edge;
