import React from 'react';
import { useGameRoom } from '../../contexts/GameContext';
import { useSocket } from '../../contexts/SocketContext';
import MiniView from '../../components/MiniView';
import { useVertexGroup } from '../../hooks/useVertexGroup';
import { VertexPanelProps } from '../../types/vertex';
import { playerColorMap } from '../../utils/soldierPlacement';
import { triggerBuildAnimation } from '../../components/ResourceSpendLayer';
import { neighborNicknames } from '../../utils/neighborLabels';
import { useBuildRules } from './useBuildRules';
import VertexInfo from './VertexInfo';
import VertexBuildActions from './VertexBuildActions';
import VertexGroupPanel from './VertexGroupPanel';
import VertexDefenderSelect from './VertexDefenderSelect';
import VertexBattleNotice from './VertexBattleNotice';
import VertexAdjacentEdges from './VertexAdjacentEdges';

/**
 * Sidebar panel for a selected vertex: mini view of the vertex and its
 * neighborhood, settlement details, and build actions.
 *
 * Troops: click your own soldiers in the mini map to build a *group*, then
 * use the group panel to move the whole group or press Attack to pick the
 * enemy group (adjacent vertex) to hit. No per-soldier card list is shown.
 */
const Vertex: React.FC<VertexPanelProps> = ({ board, vertex }) => {
  const { gameRoom, currentPlayer, setSelectedObject } = useGameRoom();
  const { buildSettlement, upgradeSettlementToCity, recruitSoldier } = useSocket();
  const buildRules = useBuildRules(board);
  const { canBuildSettlementAt, canUpgradeToCityAt, canRecruitSoldierAt } = buildRules;

  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  const owner = settlement
    ? gameRoom?.players.find((p) => p.name === settlement.ownerId) ?? null
    : null;
  const hexes = vertex.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);
  const canBuildSettlement = canBuildSettlementAt(vertex.id);
  const canUpgradeToCity =
    !!settlement && settlement.level === 'settlement' && canUpgradeToCityAt(vertex.id);
  const canRecruitSoldier =
    !!settlement && settlement.ownerId === currentPlayer?.name && canRecruitSoldierAt(vertex.id);

  const {
    soldiersHere,
    group,
    selectedGroup,
    selectableIds,
    canActIds,
    isMyTurnActionPhase,
    battle,
    groupActionsAllowed,
    groupReady,
    canAttackGroup,
    canCaptureGroup,
    canFightRobberGroup,
    healableSoldiers,
    moveTargets,
    enemyTroopsHere,
    enemyGroups,
    pendingAttack,
    clearGroup,
    handleSoldierClick,
    handleHealSoldier,
    handleGroupMove,
    handleConfirmAttack,
    handleAttackDefender,
    handleCaptureSettlement,
    handleFightRobber,
    cancelDefenderSelect,
  } = useVertexGroup(board, vertex, buildRules);

  // Nicknames (a, b, c, …) for the neighbor vertices — the same mapping the
  // mini map uses for its labels, so "Move to b" matches the "b" on the map.
  const nicknames = neighborNicknames(board, vertex.id);

  // One entry per distinct enemy group, for the defender-selection dialog.
  const defenders = enemyGroups.map((ownerName) => ({
    owner: ownerName,
    count: enemyTroopsHere.filter((s) => s.owner === ownerName).length,
    injuredCount: enemyTroopsHere.filter((s) => s.owner === ownerName && s.injured).length,
  }));

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

      <VertexInfo settlement={settlement} owner={owner} hexes={hexes} />

      <VertexBuildActions
        canBuildSettlement={canBuildSettlement}
        canUpgradeToCity={canUpgradeToCity}
        canRecruitSoldier={canRecruitSoldier}
        onBuildSettlement={handleBuildSettlement}
        onUpgradeToCity={handleUpgradeToCity}
        onRecruitSoldier={handleRecruitSoldier}
      />

      {/* Group action panel: only appears once the player has selected troops. */}
      {group.length > 0 && (
        <VertexGroupPanel
          group={group}
          healableSoldiers={healableSoldiers}
          moveTargets={moveTargets}
          nicknames={nicknames}
          isMyTurnActionPhase={isMyTurnActionPhase}
          battleInProgress={!!battle}
          groupReady={groupReady}
          canAttackGroup={canAttackGroup}
          canCaptureGroup={canCaptureGroup}
          canFightRobberGroup={canFightRobberGroup}
          enemyTroopCount={enemyTroopsHere.length}
          settlementIsCity={settlement?.level === 'city'}
          onClearGroup={clearGroup}
          onHealSoldier={handleHealSoldier}
          onGroupMove={handleGroupMove}
          onConfirmAttack={handleConfirmAttack}
          onCaptureSettlement={handleCaptureSettlement}
          onFightRobber={handleFightRobber}
        />
      )}

      {/* Defender selection dialog: shown when multiple enemy groups are on
          the target vertex and the player wants to attack. */}
      {pendingAttack && enemyGroups.length > 1 && (
        <VertexDefenderSelect
          defenders={defenders}
          onSelect={handleAttackDefender}
          onCancel={cancelDefenderSelect}
        />
      )}

      {/* Hint before any selection, when troops are present here. */}
      {selectedGroup.length === 0 && soldiersHere.length > 0 && (
        <p className="text-[13px] m-0">
          {groupActionsAllowed
            ? 'Click your soldiers in the map above to select a group, then move, attack, or capture with it.'
            : 'Soldiers act during your Action phase.'}
        </p>
      )}

      {battle && <VertexBattleNotice battle={battle} />}

      <VertexAdjacentEdges
        board={board}
        vertex={vertex}
        onSelectEdge={(edgeId) => setSelectedObject({ type: 'edge', id: edgeId })}
      />
    </div>
  );
};

export default Vertex;
