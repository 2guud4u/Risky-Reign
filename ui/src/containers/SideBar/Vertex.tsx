import React from 'react';
import { Board, VertexNode } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import MiniView from './MiniView';
import { useBuildRules } from './useBuildRules';
import { buildButtonClass, cardClass, hexChipClass } from './styles';

/**
 * Sidebar panel for a selected vertex: mini view of the vertex and its
 * neighborhood, settlement details, the Build Settlement action, and the
 * adjacent edges (each with its own Build Road action).
 */
const Vertex: React.FC<{ board: Board; vertex: VertexNode }> = ({ board, vertex }) => {
  const { gameRoom, currentPlayer, setSelectedObject } = useGameRoom();
  const { buildSettlement, buildRoad } = useSocket();
  const { canBuildSettlementAt, settlementReason, canBuildRoadOn, roadReason } =
    useBuildRules(board);

  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  const owner = settlement
    ? gameRoom?.players.find((p) => p.name === settlement.ownerId) ?? null
    : null;
  const hexes = vertex.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);
  const canBuildSettlement = canBuildSettlementAt(vertex.id);

  const adjacent = vertex.roadIds.map((edgeId) => {
    const edge = board.edges[edgeId];
    const otherId = edge ? (edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId) : null;
    return { edge, otherId };
  });

  const handleBuildSettlement = () => {
    if (!gameRoom || !currentPlayer) return;
    buildSettlement(currentPlayer.id, vertex.id, gameRoom.id);
  };

  const handleBuildRoad = (edgeId: string) => {
    if (!gameRoom || !currentPlayer) return;
    buildRoad(currentPlayer.id, edgeId, gameRoom.id);
  };

  return (
    <div className={cardClass}>
      <h3 className="m-0 text-base">Vertex {vertex.id}</h3>

      <MiniView board={board} type="vertex" id={vertex.id} />

      <div className="text-[13px]">
        <strong>Settlement:</strong>{' '}
        {settlement
          ? `${settlement.level === 'city' ? 'City' : 'Settlement'} — ${settlement.ownerId}`
          : 'None'}
        {owner && (
          <span
            className="inline-block w-2.5 h-2.5 rounded-full ml-2"
            style={{ background: owner.color || '#999' }}
          />
        )}
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

      <button
        onClick={handleBuildSettlement}
        disabled={!canBuildSettlement}
        className={buildButtonClass(canBuildSettlement)}
        title={
          canBuildSettlement ? 'Build settlement on this vertex' : settlementReason(vertex.id)
        }
      >
        Build Settlement
      </button>

      <div>
        <div className="text-[13px] font-semibold mb-1.5">Adjacent Edges</div>
        <div className="flex flex-col gap-1.5">
          {adjacent.map(({ edge, otherId }) => {
            if (!edge || otherId === null) return null;
            const road = edge.roadId ? board.roads[edge.roadId] : null;
            const other = board.vertices[otherId];
            const otherSettlement = other?.settlementId
              ? board.settlements[other.settlementId]
              : null;
            const enabled = canBuildRoadOn(edge.id);
            return (
              <div
                key={edge.id}
                className="border border-gray-200 rounded-md p-2 text-xs flex flex-col gap-1"
              >
                <button
                  className="text-left hover:underline cursor-pointer"
                  onClick={() => setSelectedObject({ type: 'edge', id: edge.id })}
                  title="Show this edge"
                >
                  <span className="text-gray-600">→ vertex </span>
                  <strong>{otherId}</strong>
                  {otherSettlement && (
                    <span className="text-[#8B4513]"> ({otherSettlement.ownerId})</span>
                  )}
                </button>
                <div className="text-gray-600">
                  Road: {road ? `owned by ${road.ownerId}` : 'none'}
                </div>
                <button
                  onClick={() => handleBuildRoad(edge.id)}
                  disabled={!enabled}
                  className={buildButtonClass(enabled)}
                  title={enabled ? 'Build road on this edge' : roadReason(edge.id)}
                >
                  Build Road
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Vertex;
