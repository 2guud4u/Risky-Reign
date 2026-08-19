import React from 'react';
import { playerSettlementVertexIds } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';

const cardClass =
  'w-[280px] border border-gray-300 rounded-lg p-3.5 bg-white flex flex-col gap-3';

const buildButtonClass = (enabled: boolean) =>
  `px-3 py-2 text-sm rounded-md border border-gray-300 ${
    enabled ? 'bg-blue-600 text-white cursor-pointer' : 'bg-gray-400 cursor-not-allowed'
  }`;

/**
 * Sidebar panel for the currently selected vertex: shows its settlement,
 * adjacent edges/vertices and hexes, and offers build actions (settlement on
 * the vertex, road on each adjacent edge) with the same eligibility rules the
 * backend enforces.
 */
const Sidebar: React.FC = () => {
  const { gameRoom, currentPlayer, selectedObject } = useGameRoom();
  const { buildSettlement, buildRoad } = useSocket();

  const board = gameRoom?.board ?? null;

  if (!gameRoom || !currentPlayer || !board) {
    return null;
  }

  const vertex = selectedObject?.type === 'vertex' ? board.vertices[selectedObject.id] : null;

  if (!vertex) {
    return (
      <div className={cardClass}>
        <h3 className="m-0 text-base">Vertex Info</h3>
        <p className="text-[13px] text-gray-500 m-0">
          Click a Vertex or Edge on the board to see its options.
        </p>
      </div>
    );
  }

  const turn = gameRoom.turnState;
  const isMyTurn = turn.player === currentPlayer.name;
  const inBuildPhase = turn.phase === 'SetUp' || turn.phase === 'Build';

  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  const owner = settlement ? gameRoom.players.find((p) => p.name === settlement.ownerId) ?? null : null;

  // Adjacent edges + their far endpoints.
  const adjacent = vertex.roadIds.map((edgeId) => {
    const edge = board.edges[edgeId];
    const otherId = edge ? (edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId) : null;
    return { edge, otherId };
  });

  const hexes = vertex.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);

  // Settlement eligibility (mirrors backend + distance rule).
  const hasAdjacentSettlement = adjacent.some(
    ({ otherId }) => otherId !== null && board.vertices[otherId]?.settlementId !== null
  );
  const canBuildSettlement =
    isMyTurn && inBuildPhase && turn.placedSettlement !== true && !settlement && !hasAdjacentSettlement;

  // Road eligibility per adjacent edge (mirrors backend + ownership rule).
  const ownedSettlementVertexIds = playerSettlementVertexIds(board, currentPlayer.name);
  const canBuildRoad = (edgeId: string) => {
    const edge = board.edges[edgeId];
    if (!edge) return false;
    return (
      isMyTurn &&
      inBuildPhase &&
      turn.placedRoad !== true &&
      edge.roadId === null &&
      (ownedSettlementVertexIds.includes(edge.vertexAId) ||
        ownedSettlementVertexIds.includes(edge.vertexBId))
    );
  };

  const handleBuildSettlement = () => {
    buildSettlement(currentPlayer.id, vertex.id, gameRoom.id);
  };

  const handleBuildRoad = (edgeId: string) => {
    buildRoad(currentPlayer.id, edgeId, gameRoom.id);
  };

  const settlementLabel = settlement
    ? `${settlement.level === 'city' ? 'City' : 'Settlement'} — ${settlement.ownerId}`
    : 'None';

  return (
    <div className={cardClass}>
      <h3 className="m-0 text-base">Vertex {vertex.id}</h3>

      <div className="text-[13px]">
        <strong>Settlement:</strong> {settlementLabel}
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
          <span key={h.id} className="inline-block mr-2 px-1.5 py-0.5 rounded bg-gray-100">
            {h.terrain}
            {h.rollNumber !== null ? ` (${h.rollNumber})` : ''}
          </span>
        ))}
      </div>

      <div>
        <div className="text-[13px] font-semibold mb-1.5">Adjacent Edges</div>
        <div className="flex flex-col gap-1.5">
          {adjacent.map(({ edge, otherId }) => {
            if (!edge || otherId === null) return null;
            const road = edge.roadId ? board.roads[edge.roadId] : null;
            const other = board.vertices[otherId];
            const otherSettlement = other?.settlementId ? board.settlements[other.settlementId] : null;
            const edgeEnabled = canBuildRoad(edge.id);
            return (
              <div
                key={edge.id}
                className="border border-gray-200 rounded-md p-2 text-xs flex flex-col gap-1"
              >
                <div>
                  <span className="text-gray-600">→ vertex </span>
                  <strong>{otherId}</strong>
                  {otherSettlement && (
                    <span className="text-[#8B4513]"> ({otherSettlement.ownerId})</span>
                  )}
                </div>
                <div className="text-gray-600">
                  Road: {road ? `owned by ${road.ownerId}` : 'none'}
                </div>
                <button
                  onClick={() => handleBuildRoad(edge.id)}
                  disabled={!edgeEnabled}
                  className={buildButtonClass(edgeEnabled)}
                  title={
                    edgeEnabled
                      ? 'Build road on this edge'
                      : !isMyTurn
                        ? 'Not your turn'
                        : !inBuildPhase
                          ? 'Only available in SetUp/Build phase'
                          : turn.placedRoad === true
                            ? 'Road already placed this turn'
                            : 'Edge must touch one of your settlements'
                  }
                >
                  Build Road
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleBuildSettlement}
        disabled={!canBuildSettlement}
        className={buildButtonClass(canBuildSettlement)}
        title={
          canBuildSettlement
            ? 'Build settlement on this vertex'
            : !isMyTurn
              ? 'Not your turn'
              : !inBuildPhase
                ? 'Only available in SetUp/Build phase'
                : turn.placedSettlement === true
                  ? 'Settlement already placed this turn'
                  : settlement
                    ? 'Vertex already occupied'
                    : 'Too close to an existing settlement'
        }
      >
        Build Settlement
      </button>
    </div>
  );
};

export default Sidebar;
