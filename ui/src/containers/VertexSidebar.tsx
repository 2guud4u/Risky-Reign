import React from 'react';
import { playerSettlementVertexIds } from 'common/v2';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

const cardStyle: React.CSSProperties = {
  width: 280,
  border: '1px solid #ccc',
  borderRadius: 8,
  padding: 14,
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
  borderRadius: 6,
  border: '1px solid #ccc',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
};

const disabledButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#9ca3af',
  cursor: 'not-allowed',
};

/**
 * Sidebar panel for the currently selected vertex: shows its settlement,
 * adjacent edges/vertices and hexes, and offers build actions (settlement on
 * the vertex, road on each adjacent edge) with the same eligibility rules the
 * backend enforces.
 */
const VertexSidebar: React.FC = () => {
  const { gameRoom, currentPlayer, selectedVertexId } = useGameRoom();
  const { buildSettlement, buildRoad } = useSocket();

  const board = gameRoom?.board ?? null;

  if (!gameRoom || !currentPlayer || !board) {
    return null;
  }

  const vertex = selectedVertexId ? board.vertices[selectedVertexId] : null;

  if (!vertex) {
    return (
      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Vertex Info</h3>
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
          Click a vertex on the board to see its details and build options.
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
    <div style={cardStyle}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Vertex {vertex.id}</h3>

      <div style={{ fontSize: 13 }}>
        <strong>Settlement:</strong> {settlementLabel}
        {owner && (
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              marginLeft: 8,
              background: owner.color || '#999',
            }}
          />
        )}
      </div>

      <div style={{ fontSize: 13 }}>
        <strong>Hexes:</strong>{' '}
        {hexes.map((h) => (
          <span
            key={h.id}
            style={{
              display: 'inline-block',
              marginRight: 8,
              padding: '2px 6px',
              borderRadius: 4,
              background: '#f0f0f0',
            }}
          >
            {h.terrain}
            {h.rollNumber !== null ? ` (${h.rollNumber})` : ''}
          </span>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Adjacent Edges</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {adjacent.map(({ edge, otherId }) => {
            if (!edge || otherId === null) return null;
            const road = edge.roadId ? board.roads[edge.roadId] : null;
            const other = board.vertices[otherId];
            const otherSettlement = other?.settlementId ? board.settlements[other.settlementId] : null;
            const edgeEnabled = canBuildRoad(edge.id);
            return (
              <div
                key={edge.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div>
                  <span style={{ color: '#555' }}>→ vertex </span>
                  <strong>{otherId}</strong>
                  {otherSettlement && (
                    <span style={{ color: '#8B4513' }}> ({otherSettlement.ownerId})</span>
                  )}
                </div>
                <div style={{ color: '#555' }}>
                  Road: {road ? `owned by ${road.ownerId}` : 'none'}
                </div>
                <button
                  onClick={() => handleBuildRoad(edge.id)}
                  disabled={!edgeEnabled}
                  style={edgeEnabled ? buttonStyle : disabledButtonStyle}
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
        style={canBuildSettlement ? buttonStyle : disabledButtonStyle}
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

export default VertexSidebar;
