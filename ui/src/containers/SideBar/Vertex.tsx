import React, { useState } from 'react';
import { Board, CityPrice, SettlementPrice, SoldierObj, SoldierPrice, VertexNode } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import MiniView from './MiniView';
import { useBuildRules } from './useBuildRules';
import { buildButtonClass, hexChipClass } from './styles';
import { playerColorMap } from '../../utils/soldierPlacement';
import { priceLabel } from '../../utils/price';

/**
 * Sidebar panel for a selected vertex: mini view of the vertex and its
 * neighborhood, settlement details, and build actions.
 *
 * Troops: click your own soldiers in the mini map to build a *group*, then
 * use the group panel to move the whole group or press Attack to pick the
 * enemy group (adjacent vertex) to hit. No per-soldier card list is shown.
 */
const Vertex: React.FC<{ board: Board; vertex: VertexNode }> = ({ board, vertex }) => {
  const { gameRoom, currentPlayer, setSelectedObject } = useGameRoom();
  const { buildSettlement, upgradeSettlementToCity, buildSoldier, moveSoldier, healSoldier, startAttack } = useSocket();
  const {
    canBuildSettlementAt,
    settlementReason,
    canUpgradeToCityAt,
    upgradeReason,
    canBuildSoldierAt,
    soldierReason,
    canMoveSoldierTo,
    moveSoldierReason,
  } = useBuildRules(board);

  // Group of soldier ids the player is assembling for a group action.
  const [selectedGroup, setSelectedGroup] = useState<string[]>([]);
  const [attackMode, setAttackMode] = useState(false);

  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  const owner = settlement
    ? gameRoom?.players.find((p) => p.name === settlement.ownerId) ?? null
    : null;
  const hexes = vertex.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);
  const canBuildSettlement = canBuildSettlementAt(vertex.id);

  const soldiersHere = Object.values(board.soldiers ?? {}).filter((s) => s.vertexId === vertex.id);
  const mySoldiersHere = soldiersHere.filter((s) => s.owner === currentPlayer?.name);

  const turn = gameRoom?.turnState;
  const isMyTurnActionPhase =
    currentPlayer !== null &&
    turn !== undefined &&
    turn.player === currentPlayer.name &&
    turn.phase === 'Action';

  const battle = gameRoom?.battleState ?? null;
  // Group actions are only possible on your Action phase and when no battle is running.
  const groupActionsAllowed = isMyTurnActionPhase && !battle;

  // Only the current player's soldiers can be clicked in the mini map.
  const selectableIds = new Set(groupActionsAllowed ? mySoldiersHere.map((s) => s.id) : []);

  // The live soldiers backing the current selection (guards against stale ids).
  const group: SoldierObj[] = [];
  for (const id of selectedGroup) {
    const s = board.soldiers?.[id];
    if (s && s.vertexId === vertex.id) group.push(s);
  }

  /** Whether a soldier can spend its one action this phase (move or attack). */
  const soldierCanAct = (s: SoldierObj): boolean => {
    if (!turn) return false;
    return (
      !s.injured &&
      !turn.soldiersActedThisTurn.includes(s.id) &&
      !turn.soldiersCreatedThisTurn.includes(s.id)
    );
  };

  const groupReady = groupActionsAllowed && group.length > 0 && group.every((s) => soldierCanAct(s));

  // Vertices reachable from here via existing roads (deduped defensively).
  const roadAdjacentVertices = Array.from(
    new Set(
      vertex.roadIds
        .map((edgeId) => {
          const edge = board.edges[edgeId];
          if (!edge || edge.roadId === null) return null;
          const otherId = edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId;
          return otherId ?? null;
        })
        .filter((id): id is string => id !== null && id !== undefined)
    )
  );

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

  const adjacent = Array.from(new Set(vertex.roadIds)).map((edgeId) => {
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

  const handleBuildSoldier = () => {
    if (!gameRoom || !currentPlayer) return;
    buildSoldier(currentPlayer.id, vertex.id, gameRoom.id);
  };

  const clearGroup = () => {
    setSelectedGroup([]);
    setAttackMode(false);
  };

  // Clicking a soldier in the mini view toggles it in/out of the group.
  const handleSoldierClick = (soldierId: string) => {
    if (!selectableIds.has(soldierId)) return;
    setAttackMode(false);
    setSelectedGroup((prev) =>
      prev.includes(soldierId) ? prev.filter((id) => id !== soldierId) : [...prev, soldierId]
    );
  };

  const handleHealSoldier = (soldierId: string) => {
    if (!gameRoom || !currentPlayer) return;
    healSoldier(currentPlayer.id, soldierId, gameRoom.id);
  };

  // Move every selected soldier to the target vertex (one action each).
  const handleGroupMove = (targetVertexId: string) => {
    if (!gameRoom || !currentPlayer) return;
    for (const s of group) {
      if (canMoveSoldierTo(s.id, targetVertexId)) {
        moveSoldier(currentPlayer.id, s.id, targetVertexId, gameRoom.id);
      }
    }
    clearGroup();
  };

  // Commit the whole group in an attack against the chosen enemy vertex.
  const handleConfirmAttack = (targetVertexId: string) => {
    if (!gameRoom || !currentPlayer) return;
    startAttack(currentPlayer.id, group.map((s) => s.id), targetVertexId, gameRoom.id);
    clearGroup();
  };

  // Enemy groups in range: adjacent (via road) vertices with enemy presence.
  const attackTargets = groupReady
    ? roadAdjacentVertices.filter((t) => hasEnemyAt(t))
    : [];

  const renderGroupPanel = () => {
    if (group.length === 0) return null;

    const injured = group.filter((s) => s.injured);

    return (
      <div className="border border-blue-200 bg-blue-50/60 rounded-md p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold">Your Group ({group.length})</div>
          <button
            type="button"
            onClick={clearGroup}
            className="text-[11px] text-gray-500 hover:text-gray-700"
          >
            ✕ Clear
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {group.map((s) => (
            <span
              key={s.id}
              className={`px-1.5 py-0.5 rounded text-[11px] border ${
                s.injured ? 'bg-red-100 border-red-200 text-red-700' : 'bg-white border-gray-300'
              }`}
            >
              {s.owner}
              {s.injured ? ' (injured)' : ''}
            </span>
          ))}
        </div>

        {!isMyTurnActionPhase && (
          <div className="text-gray-500 text-[11px]">Actions available on your Action phase.</div>
        )}
        {isMyTurnActionPhase && battle && (
          <div className="text-gray-500 text-[11px]">A battle is already in progress.</div>
        )}

        {/* Heal actions for injured members. */}
        {injured.length > 0 && (
          <div className="flex flex-col gap-1">
            {injured.map((s) => {
              const canHeal =
                groupActionsAllowed &&
                turn !== undefined &&
                !turn.soldiersActedThisTurn.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => handleHealSoldier(s.id)}
                  disabled={!canHeal}
                  className={buildButtonClass(canHeal)}
                  title={`Heal ${s.owner} (2 Wheat, 2 Sheep)`}
                >
                  ✚ Heal {s.owner}
                </button>
              );
            })}
          </div>
        )}

        {/* Move / attack actions for the (actionable) group. */}
        {groupReady && (
          <>
            <div>
              <div className="text-[12px] font-semibold text-gray-600 mb-1">
                Move all {group.length} to:
              </div>
              <div className="flex flex-col gap-1">
                {roadAdjacentVertices.map((targetId) => {
                  const allCanMove = group.every((s) => canMoveSoldierTo(s.id, targetId));
                  const reason = group
                    .map((s) => (canMoveSoldierTo(s.id, targetId) ? null : moveSoldierReason(s.id, targetId)))
                    .find((r) => r !== null);
                  return (
                    <button
                      key={targetId}
                      onClick={() => handleGroupMove(targetId)}
                      disabled={!allCanMove}
                      className={buildButtonClass(allCanMove)}
                      title={allCanMove ? `Move the group to ${targetId}` : reason ?? 'Cannot move there'}
                    >
                      → Move to {targetId}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setAttackMode((v) => !v)}
              disabled={attackTargets.length === 0}
              className={buildButtonClass(attackTargets.length > 0)}
              title={
                attackTargets.length > 0
                  ? 'Choose which enemy group to attack'
                  : 'No enemy group in range'
              }
            >
              ⚔ Attack
            </button>

            {attackMode && (
              <div className="border border-amber-300 bg-amber-50 rounded-md p-2 flex flex-col gap-1.5">
                <div className="text-[12px] font-semibold">Choose the enemy group to attack:</div>
                {attackTargets.map((targetId) => {
                  const targetVertex = board.vertices[targetId];
                  const targetSettlement = targetVertex?.settlementId
                    ? board.settlements[targetVertex.settlementId]
                    : null;
                  const enemySoldiers = Object.values(board.soldiers ?? {}).filter(
                    (s) => s.vertexId === targetId && s.owner !== currentPlayer?.name
                  );
                  const defender =
                    targetSettlement?.ownerId ?? enemySoldiers[0]?.owner ?? 'enemy';
                  return (
                    <button
                      key={targetId}
                      onClick={() => handleConfirmAttack(targetId)}
                      className={buildButtonClass(true)}
                    >
                      ⚔ {targetId} — {defender}
                      {enemySoldiers.length > 0 ? ` · ${enemySoldiers.length} troop(s)` : ''}
                      {targetSettlement
                        ? ` · ${targetSettlement.level === 'city' ? 'city' : 'settlement'}`
                        : ''}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAttackMode(false)}
                  className="text-left text-[11px] text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-base">Vertex {vertex.id}</h3>

      <MiniView
        board={board}
        type="vertex"
        id={vertex.id}
        playerColors={playerColorMap(gameRoom)}
        onSoldierClick={handleSoldierClick}
        selectedSoldierIds={new Set(selectedGroup)}
        selectableSoldierIds={selectableIds}
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

      {settlement && settlement.ownerId === currentPlayer?.name && (
        <button
          onClick={handleBuildSoldier}
          disabled={!canBuildSoldierAt(vertex.id)}
          className={buildButtonClass(canBuildSoldierAt(vertex.id))}
          title={
            canBuildSoldierAt(vertex.id)
              ? `Build a soldier here (${priceLabel(SoldierPrice)})`
              : soldierReason(vertex.id)
          }
        >
          ⚔ Build Soldier <span className="text-gray-500 text-xs">({priceLabel(SoldierPrice)})</span>
        </button>
      )}

      {/* Group action panel: only appears once the player has selected troops. */}
      {renderGroupPanel()}

      {/* Hint before any selection, when troops are present here. */}
      {selectedGroup.length === 0 && soldiersHere.length > 0 && (
        <p className="text-[13px] text-gray-500 m-0">
          {groupActionsAllowed
            ? 'Click your soldiers in the map above to select a group, then move or attack with it.'
            : 'Soldiers act during your Action phase.'}
        </p>
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
