import React, { useState, useEffect } from 'react';
import { Board, CityPrice, SettlementPrice, SoldierObj, SoldierPrice, VertexNode } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import MiniView from '../../components/MiniView';
import { useBuildRules } from './useBuildRules';
import { buildButtonClass, hexChipClass } from './styles';
import { playerColorMap } from '../../utils/soldierPlacement';
import { priceLabel } from '../../utils/price';
import { triggerBuildAnimation } from '../../components/ResourceSpendLayer';
import { neighborNicknames } from '../../utils/neighborLabels';

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
  const { buildSettlement, upgradeSettlementToCity, recruitSoldier, moveSoldier, healSoldier, startAttack, captureSettlement, fightRobber } = useSocket();
  const {
    canBuildSettlementAt,
    canUpgradeToCityAt,
    canRecruitSoldierAt,
    canMoveSoldierTo,
    canHealSoldierAt,
    canCaptureSettlementAt,
    canFightRobberAt,
  } = useBuildRules(board);

  // Group of soldier ids the player is assembling for a group action.
  const [selectedGroup, setSelectedGroup] = useState<string[]>([]);
  // The chosen defender when multiple enemy groups are on the target vertex.
  const [pendingAttack, setPendingAttack] = useState(false);

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

  /** Whether a soldier still has its one action to spend this phase. Injured
      soldiers can still spend it on a move (they just can't attack — Rule 28),
      so injury does not block the action. */
  const soldierCanAct = (s: SoldierObj): boolean => {
    if (!turn) return false;
    return !turn.soldiersActedThisTurn.includes(s.id) && !turn.soldiersCreatedThisTurn.includes(s.id);
  };

  // My garrisoned soldiers that still have their one action to spend this
  // phase — shown pulsing in the mini view so the player knows they can be used.
  const canActIds = new Set(
    groupActionsAllowed ? mySoldiersHere.filter(soldierCanAct).map((s) => s.id) : []
  );

  // When the selected vertex changes, auto-select my soldiers on it that still
  // have their action to spend this phase, so the player can act on them
  // without manually picking each one.
  useEffect(() => {
    if (!groupActionsAllowed) {
      setSelectedGroup([]);
      return;
    }
    setSelectedGroup(mySoldiersHere.filter(soldierCanAct).map((s) => s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertex.id]);

  // Move is available whenever the group can act; attack additionally requires
  // every member to be uninjured (injured state cannot attack — Rule 28).
  const groupReady = groupActionsAllowed && group.length > 0 && group.every((s) => soldierCanAct(s));
  const canAttackGroup =
    groupActionsAllowed && group.length > 0 && group.every((s) => !s.injured && soldierCanAct(s));
  // Capture is available when the group can act and the vertex holds a
  // settlement/city that is not yours, with no enemy or other troops there.
  const canCaptureGroup =
    groupActionsAllowed && group.length > 0 && group.every((s) => canCaptureSettlementAt(s.id, vertex.id));
  // The robber fight is 1v1 and once per player per Action phase, so it is
  // offered when any group member can fight; the first eligible soldier goes.
  const canFightRobberGroup =
    groupActionsAllowed && group.some((s) => canFightRobberAt(s.id, vertex.id));

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

  // Nicknames (a, b, c, …) for the neighbor vertices — the same mapping the
  // mini map uses for its labels, so "Move to b" matches the "b" on the map.
  const nicknames = neighborNicknames(board, vertex.id);

  /** Enemy soldiers garrisoned on this vertex (the only valid attack target). */
  const enemyTroopsHere = Object.values(board.soldiers ?? {}).filter(
    (s) => s.vertexId === vertex.id && s.owner !== currentPlayer?.name
  );
  // Distinct enemy groups (owners) on this vertex — when there are 2 or
  // more, the attacker must choose which group to fight.
  const enemyGroups = Array.from(
    new Set(enemyTroopsHere.map((s) => s.owner))
  );

  const adjacent = Array.from(new Set(vertex.roadIds)).map((edgeId) => {
    const edge = board.edges[edgeId];
    const otherId = edge ? (edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId) : null;
    return { edge, otherId };
  });

  const handleBuildSettlement = () => {
    if (!gameRoom || !currentPlayer) return;
    buildSettlement(currentPlayer.id, vertex.id, gameRoom.id);
    triggerBuildAnimation({ type: 'settlement', locationId: vertex.id });
  };

  const handleUpgradeToCity = () => {
    if (!gameRoom || !currentPlayer) return;
    upgradeSettlementToCity(currentPlayer.id, vertex.id, gameRoom.id);
    triggerBuildAnimation({ type: 'city', locationId: vertex.id });
  };

  const handleRecruitSoldier = () => {
    if (!gameRoom || !currentPlayer) return;
    recruitSoldier(currentPlayer.id, vertex.id, gameRoom.id);
    triggerBuildAnimation({ type: 'soldier', locationId: vertex.id });
  };

  const clearGroup = () => {
    setSelectedGroup([]);
  };

  // Clicking a soldier in the mini view toggles it in/out of the group.
  const handleSoldierClick = (soldierId: string) => {
    if (!selectableIds.has(soldierId)) return;
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

  // Commit the whole group in an attack against the enemy soldiers on this
  // vertex. When multiple enemy groups are present, show a selection dialog
  // to choose which group to fight.
  const handleConfirmAttack = () => {
    if (!gameRoom || !currentPlayer) return;
    if (enemyGroups.length > 1) {
      setPendingAttack(true);
      return;
    }
    startAttack(currentPlayer.id, group.map((s) => s.id), vertex.id, gameRoom.id);
    clearGroup();
  };

  // Commit the attack against the chosen defender group.
  const handleAttackDefender = (defenderName: string) => {
    if (!gameRoom || !currentPlayer) return;
    startAttack(currentPlayer.id, group.map((s) => s.id), vertex.id, gameRoom.id, defenderName);
    setPendingAttack(false);
    clearGroup();
  };

  // Commit the whole group to capture the settlement/city on this vertex.
  const handleCaptureSettlement = () => {
    if (!gameRoom || !currentPlayer) return;
    captureSettlement(currentPlayer.id, group.map((s) => s.id), vertex.id, gameRoom.id);
    clearGroup();
  };

  // Send the first eligible soldier to fight the robber 1v1 (once per phase).
  const handleFightRobber = () => {
    if (!gameRoom || !currentPlayer) return;
    const fighter = group.find((s) => canFightRobberAt(s.id, vertex.id));
    if (!fighter) return;
    fightRobber(currentPlayer.id, fighter.id, vertex.id, gameRoom.id);
    clearGroup();
  };

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
            className="text-[11px] text-gray-100 hover:text-gray-700"
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
          <div className="text-gray-100 text-[11px]">Actions available on your Action phase.</div>
        )}
        {isMyTurnActionPhase && battle && (
          <div className="text-gray-100 text-[11px]">A battle is already in progress.</div>
        )}

        {/* Heal actions for injured members. */}
        {injured.length > 0 && (
          <div className="flex flex-col gap-1">
            {injured.map((s) => {
              const canHeal = groupActionsAllowed && canHealSoldierAt(s.id);
              return canHeal ? (
                <button
                  key={s.id}
                  onClick={() => handleHealSoldier(s.id)}
                  className={buildButtonClass}
                  title={`Heal ${s.owner} (2 Wheat, 2 Sheep)`}
                >
                  ✚ Heal {s.owner}
                </button>
              ) : null;
            })}
          </div>
        )}

        {/* Move actions for the (actionable) group — injured included. */}
        {groupReady && (
          <div>
              <div className="text-[12px] font-semibold text-gray-600 mb-1">
                Move all {group.length} to:
              </div>
              <div className="flex flex-col gap-1">
                {roadAdjacentVertices.map((targetId) => {
                  const allCanMove = group.every((s) => canMoveSoldierTo(s.id, targetId));
                  return allCanMove ? (
                    <button
                      key={targetId}
                      onClick={() => handleGroupMove(targetId)}
                      className={buildButtonClass}
                      title={`Move the group to ${targetId}`}
                    >
                      → Move to {nicknames[targetId] ?? targetId}
                    </button>
                  ) : null;
                })}
              </div>
          </div>
        )}

        {/* Attack action — only when every group member is uninjured (Rule 28). */}
        {canAttackGroup && enemyTroopsHere.length > 0 && (
          <button
            onClick={handleConfirmAttack}
            className={buildButtonClass}
            title={`Attack the ${enemyTroopsHere.length} enemy troop(s) on this vertex`}
          >
            ⚔ Attack {enemyTroopsHere.length} enemy troop{enemyTroopsHere.length === 1 ? '' : 's'} here
          </button>
        )}

        {/* Capture action — the vertex holds a settlement/city that is not
            ours and no enemy or other troops are on the vertex. */}
        {canCaptureGroup && (
          <button
            onClick={handleCaptureSettlement}
            className={buildButtonClass}
            title={`Capture the ${settlement?.level === 'city' ? 'city' : 'settlement'} on this vertex`}
          >
            🚩 Capture {settlement?.level === 'city' ? 'City' : 'Settlement'}
          </button>
        )}

        {/* Robber fight — the robber sits on one of this vertex's hexes;
            1v1, once per player per Action phase. */}
        {canFightRobberGroup && (
          <button
            onClick={handleFightRobber}
            className={buildButtonClass}
            title="Fight the robber 1v1 — win the robber bag or lose the soldier (once per phase)"
          >
            🛡 Fight the Robber
          </button>
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
        canActSoldierIds={canActIds}
        currentPlayer={currentPlayer?.name}
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

      {canBuildSettlement && (
        <button
          onClick={handleBuildSettlement}
          className={buildButtonClass}
          title={`Build settlement (${priceLabel(SettlementPrice)})`}
        >
          Build Settlement <span className="text-white text-xs">({priceLabel(SettlementPrice)})</span>
        </button>
      )}

      {settlement && settlement.level === 'settlement' && canUpgradeToCityAt(vertex.id) && (
        <button
          onClick={handleUpgradeToCity}
          className={buildButtonClass}
          title={`Upgrade to city (${priceLabel(CityPrice)})`}
        >
          Upgrade to City <span className="text-white text-xs">({priceLabel(CityPrice)})</span>
        </button>
      )}

      {settlement && settlement.ownerId === currentPlayer?.name && canRecruitSoldierAt(vertex.id) && (
        <button
          onClick={handleRecruitSoldier}
          className={buildButtonClass}
          title={`Recruit a soldier here (${priceLabel(SoldierPrice)})`}
        >
          ⚔ Recruit Soldier <span className="text-white text-xs">({priceLabel(SoldierPrice)})</span>
        </button>
      )}

      {/* Group action panel: only appears once the player has selected troops. */}
      {renderGroupPanel()}

      {/* Defender selection dialog: shown when multiple enemy groups are on
          the target vertex and the player wants to attack. */}
      {pendingAttack && enemyGroups.length > 1 && (
        <div className="border border-blue-300 bg-blue-50 rounded-md p-2.5 flex flex-col gap-2">
          <div className="text-[13px] font-semibold">Choose which group to fight:</div>
          <div className="flex flex-col gap-1">
            {enemyGroups.map((ownerName) => {
              const count = enemyTroopsHere.filter((s) => s.owner === ownerName).length;
              const injuredCount = enemyTroopsHere.filter((s) => s.owner === ownerName && s.injured).length;
              return (
                <button
                  key={ownerName}
                  onClick={() => handleAttackDefender(ownerName)}
                  className={buildButtonClass}
                  title={`Fight ${ownerName}'s ${count} troop(s)`}
                >
                  ⚔ Fight {ownerName} ({count} troop{count === 1 ? '' : 's'}{injuredCount > 0 ? `, ${injuredCount} injured` : ''})
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPendingAttack(false)}
            className="text-[11px] text-gray-600 hover:text-gray-800"
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Hint before any selection, when troops are present here. */}
      {selectedGroup.length === 0 && soldiersHere.length > 0 && (
        <p className="text-[13px] m-0">
          {groupActionsAllowed
            ? 'Click your soldiers in the map above to select a group, then move, attack, or capture with it.'
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
                  <strong>{nicknames[otherId] ?? otherId}</strong>
                  <span className="text-gray-400"> ({otherId})</span>
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
