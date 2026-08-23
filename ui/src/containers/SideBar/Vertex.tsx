import React, { useState } from 'react';
import { Board, CityPrice, SettlementPrice, VertexNode } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import MiniView from './MiniView';
import { useBuildRules } from './useBuildRules';
import { buildButtonClass, hexChipClass } from './styles';
import { playerColorMap } from '../../utils/soldierPlacement';
import { priceLabel } from '../../utils/price';

/**
 * Sidebar panel for a selected vertex: mini view of the vertex and its
 * neighborhood (click a soldier there to select it), settlement details,
 * build actions, and per-soldier actions (move / heal / attack) for the
 * currently selected soldier.
 */
const Vertex: React.FC<{ board: Board; vertex: VertexNode }> = ({ board, vertex }) => {
  const { gameRoom, currentPlayer, setSelectedObject } = useGameRoom();
  const { buildSettlement, upgradeSettlementToCity, moveSoldier, healSoldier, startAttack } = useSocket();
  const {
    canBuildSettlementAt,
    settlementReason,
    canUpgradeToCityAt,
    upgradeReason,
    canMoveSoldierTo,
    moveSoldierReason,
  } = useBuildRules(board);

  const [selectedSoldierId, setSelectedSoldierId] = useState<string | null>(null);

  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  const owner = settlement
    ? gameRoom?.players.find((p) => p.name === settlement.ownerId) ?? null
    : null;
  const hexes = vertex.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);
  const canBuildSettlement = canBuildSettlementAt(vertex.id);

  const soldiersHere = Object.values(board.soldiers ?? {}).filter((s) => s.vertexId === vertex.id);

  const turn = gameRoom?.turnState;
  const isMyTurnActionPhase =
    currentPlayer !== null &&
    turn !== undefined &&
    turn.player === currentPlayer.name &&
    turn.phase === 'Action';

  // Adjacent vertices reachable via existing roads.
  const roadAdjacentVertices = vertex.roadIds
    .map((edgeId) => {
      const edge = board.edges[edgeId];
      if (!edge || edge.roadId === null) return null;
      const otherId = edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId;
      return otherId ?? null;
    })
    .filter((id): id is string => id !== null && id !== undefined);

  /** Whether a vertex has enemy presence (settlement or soldiers). */
  const hasEnemyAt = (targetId: string): boolean => {
    const v = board.vertices[targetId];
    if (!v) return false;
    if (v.settlementId !== null) {
      const stl = board.settlements[v.settlementId];
      if (stl && stl.ownerId !== currentPlayer?.name) return true;
    }
    return Object.values(board.soldiers ?? {}).some(
      (s) => s.vertexId === targetId && s.owner !== currentPlayer?.name
    );
  };

  const adjacent = vertex.roadIds.map((edgeId) => {
    const edge = board.edges[edgeId];
    const otherId = edge ? (edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId) : null;
    return { edge, otherId };
  });

  const battle = gameRoom?.battleState ?? null;

  const handleBuildSettlement = () => {
    if (!gameRoom || !currentPlayer) return;
    buildSettlement(currentPlayer.id, vertex.id, gameRoom.id);
  };

  const handleUpgradeToCity = () => {
    if (!gameRoom || !currentPlayer) return;
    upgradeSettlementToCity(currentPlayer.id, vertex.id, gameRoom.id);
  };

  const handleMoveSoldier = (soldierId: string, targetVertexId: string) => {
    if (!gameRoom || !currentPlayer) return;
    moveSoldier(currentPlayer.id, soldierId, targetVertexId, gameRoom.id);
  };

  const handleHealSoldier = (soldierId: string) => {
    if (!gameRoom || !currentPlayer) return;
    healSoldier(currentPlayer.id, soldierId, gameRoom.id);
  };

  const handleAttack = (soldierId: string, targetVertexId: string) => {
    if (!gameRoom || !currentPlayer) return;
    startAttack(currentPlayer.id, [soldierId], targetVertexId, gameRoom.id);
  };

  // Selecting a soldier in the mini view is a toggle: click to select,
  // click the same soldier again to deselect.
  const handleSoldierClick = (soldierId: string) =>
    setSelectedSoldierId((prev) => (prev === soldierId ? null : soldierId));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-base">Vertex {vertex.id}</h3>

      <MiniView
        board={board}
        type="vertex"
        id={vertex.id}
        playerColors={playerColorMap(gameRoom)}
        onSoldierClick={handleSoldierClick}
        selectedSoldierId={selectedSoldierId}
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
          canBuildSettlement ? `Build settlement (${priceLabel(SettlementPrice)})` : settlementReason(vertex.id)
        }
      >
        Build Settlement <span className="text-gray-500 text-xs">({priceLabel(SettlementPrice)})</span>
      </button>

      {settlement && settlement.level === 'settlement' && (
        <button
          onClick={handleUpgradeToCity}
          disabled={!canUpgradeToCityAt(vertex.id)}
          className={buildButtonClass(canUpgradeToCityAt(vertex.id))}
          title={
            canUpgradeToCityAt(vertex.id)
              ? `Upgrade to city (${priceLabel(CityPrice)})`
              : upgradeReason(vertex.id)
          }
        >
          Upgrade to City <span className="text-gray-500 text-xs">({priceLabel(CityPrice)})</span>
        </button>
      )}

      {soldiersHere.length > 0 && (
        <div>
          <div className="text-[13px] font-semibold mb-1.5">
            Soldiers Here{' '}
            <span className="font-normal text-gray-400">(click a soldier in the map above)</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {soldiersHere.map((s) => {
              const isSelected = selectedSoldierId === s.id;
              const isMine = currentPlayer !== null && s.owner === currentPlayer.name;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSoldierId(s.id)}
                  className={`border rounded-md p-2 text-xs cursor-pointer ${
                    isSelected ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <strong>{s.owner}</strong> — {s.type}
                    {s.injured && <span className="text-red-600 ml-1">(injured)</span>}
                    {turn?.soldiersActedThisTurn.includes(s.id) && (
                      <span className="text-gray-400 ml-1">(acted)</span>
                    )}
                  </div>

                  {/* Actions for the selected soldier */}
                  {isSelected && isMine && turn && (
                    <div className="mt-2 flex flex-col gap-1">
                      {!isMyTurnActionPhase && (
                        <div className="text-gray-500 text-[11px]">
                          Actions available on your Action phase.
                        </div>
                      )}

                      {s.injured ? (
                        <button
                          onClick={() => handleHealSoldier(s.id)}
                          disabled={!isMyTurnActionPhase || turn.soldiersActedThisTurn.includes(s.id)}
                          className={buildButtonClass(
                            isMyTurnActionPhase && !turn.soldiersActedThisTurn.includes(s.id)
                          )}
                          title="Heal this injured soldier (2 Wheat, 2 Sheep)"
                        >
                          ✚ Heal
                        </button>
                      ) : (
                        <>
                          {roadAdjacentVertices.map((targetId) => {
                            const enabled = canMoveSoldierTo(s.id, targetId);
                            return (
                              <button
                                key={targetId}
                                onClick={() => handleMoveSoldier(s.id, targetId)}
                                disabled={!enabled}
                                className={buildButtonClass(enabled)}
                                title={
                                  enabled ? `Move soldier to ${targetId}` : moveSoldierReason(s.id, targetId)
                                }
                              >
                                → Move to {targetId}
                              </button>
                            );
                          })}

                          {roadAdjacentVertices.filter((t) => hasEnemyAt(t)).map((targetId) => {
                            const eligible =
                              isMyTurnActionPhase &&
                              !turn.soldiersActedThisTurn.includes(s.id) &&
                              !turn.soldiersCreatedThisTurn.includes(s.id);
                            return (
                              <button
                                key={`atk-${targetId}`}
                                onClick={() => handleAttack(s.id, targetId)}
                                disabled={!eligible}
                                className={buildButtonClass(eligible)}
                                title={
                                  eligible
                                    ? `Send this soldier to attack ${targetId}`
                                    : 'Cannot attack: injured/acted/freshly built or not your Action phase'
                                }
                              >
                                ⚔ Attack {targetId}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {isSelected && !isMine && (
                    <div className="mt-1.5 text-gray-400 text-[11px]">Enemy soldier</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {battle && (
        <div className="border border-amber-300 bg-amber-50 rounded-md p-2 text-xs">
          <div className="font-semibold mb-1">⚔ Battle at {battle.vertexId}</div>
          <div className="text-gray-700">
            {battle.attacker} attacks {battle.defender || '—'} — see the Battle tab for details.
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Vertex;
