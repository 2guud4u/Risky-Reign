import React from 'react';
import { Board, VertexNode } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import MiniView from './MiniView';
import { useBuildRules } from './useBuildRules';
import { buildButtonClass, hexChipClass } from './styles';

/**
 * Sidebar panel for a selected vertex: mini view of the vertex and its
 * neighborhood, settlement details, the Build Settlement action, and the
 * adjacent edges (each with its own Build Road action).
 */
const Vertex: React.FC<{ board: Board; vertex: VertexNode }> = ({ board, vertex }) => {
  const { gameRoom, currentPlayer, setSelectedObject } = useGameRoom();
  const { buildSettlement, buildRoad, upgradeSettlementToCity, buildSoldier, moveSoldier } = useSocket();
  const {
    canBuildSettlementAt,
    settlementReason,
    canBuildRoadOn,
    roadReason,
    canUpgradeToCityAt,
    upgradeReason,
    canBuildSoldierAt,
    soldierReason,
    canMoveSoldierTo,
    moveSoldierReason,
  } = useBuildRules(board);

  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  const owner = settlement
    ? gameRoom?.players.find((p) => p.name === settlement.ownerId) ?? null
    : null;
  const hexes = vertex.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);
  const canBuildSettlement = canBuildSettlementAt(vertex.id);
  const soldiersHere = Object.values(board.soldiers ?? {}).filter((s) => s.vertexId === vertex.id);
  const mySoldiersHere = soldiersHere.filter((s) => currentPlayer && s.owner === currentPlayer.name);

  // Adjacent vertices reachable via existing roads (for soldier movement).
  const roadAdjacentVertices = vertex.roadIds
    .map((edgeId) => {
      const edge = board.edges[edgeId];
      if (!edge || edge.roadId === null) return null;
      const otherId = edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId;
      return otherId ?? null;
    })
    .filter((id): id is string => id !== null && id !== undefined);

  const adjacent = vertex.roadIds.map((edgeId) => {
    const edge = board.edges[edgeId];
    const otherId = edge ? (edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId) : null;
    return { edge, otherId };
  });

  const handleBuildSettlement = () => {
    if (!gameRoom || !currentPlayer) return;
    buildSettlement(currentPlayer.id, vertex.id, gameRoom.id);
  };

  const handleUpgradeToCity = () => {
    if (!gameRoom || !currentPlayer) return;
    upgradeSettlementToCity(currentPlayer.id, vertex.id, gameRoom.id);
  };

  const handleBuildRoad = (edgeId: string) => {
    if (!gameRoom || !currentPlayer) return;
    buildRoad(currentPlayer.id, edgeId, gameRoom.id);
  };

  const handleBuildSoldier = () => {
    if (!gameRoom || !currentPlayer) return;
    buildSoldier(currentPlayer.id, vertex.id, gameRoom.id);
  };

  const handleMoveSoldier = (soldierId: string, targetVertexId: string) => {
    if (!gameRoom || !currentPlayer) return;
    moveSoldier(currentPlayer.id, soldierId, targetVertexId, gameRoom.id);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-base">Vertex {vertex.id}</h3>

      <MiniView
        board={board}
        type="vertex"
        id={vertex.id}
        playerColors={Object.fromEntries((gameRoom?.players ?? []).map((p) => [p.name, p.color]))}
      />

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

      {settlement && settlement.level === 'settlement' && (
        <button
          onClick={handleUpgradeToCity}
          disabled={!canUpgradeToCityAt(vertex.id)}
          className={buildButtonClass(canUpgradeToCityAt(vertex.id))}
          title={
            canUpgradeToCityAt(vertex.id)
              ? 'Upgrade to city (2 Wheat, 3 Ore)'
              : upgradeReason(vertex.id)
          }
        >
          Upgrade to City
        </button>
      )}

      {settlement && (
        <button
          onClick={handleBuildSoldier}
          disabled={!canBuildSoldierAt(vertex.id)}
          className={buildButtonClass(canBuildSoldierAt(vertex.id))}
          title={
            canBuildSoldierAt(vertex.id)
              ? 'Build soldier on this settlement (1 Wheat, 1 Sheep)'
              : soldierReason(vertex.id)
          }
        >
          Build Soldier
        </button>
      )}

      {soldiersHere.length > 0 && (
        <div>
          <div className="text-[13px] font-semibold mb-1.5">Soldiers Here</div>
          <div className="flex flex-col gap-1.5">
            {soldiersHere.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-md p-2 text-xs">
                <div>
                  <strong>{s.owner}</strong> — {s.type}
                  {s.injured && <span className="text-red-600 ml-1">(injured)</span>}
                </div>
                {mySoldiersHere.some((ms) => ms.id === s.id) && roadAdjacentVertices.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-1">
                    <span className="text-gray-600 font-medium">Move to:</span>
                    {roadAdjacentVertices.map((targetId) => {
                      const enabled = canMoveSoldierTo(s.id, targetId);
                      return (
                        <button
                          key={targetId}
                          onClick={() => handleMoveSoldier(s.id, targetId)}
                          disabled={!enabled}
                          className={buildButtonClass(enabled)}
                          title={enabled ? `Move soldier to ${targetId}` : moveSoldierReason(s.id, targetId)}
                        >
                          → {targetId}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
