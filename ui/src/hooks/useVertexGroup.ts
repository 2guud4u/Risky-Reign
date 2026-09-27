import { useEffect, useState } from 'react';
import { Board, SoldierObj, VertexId, VertexNode } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { SoldierActionRules } from '../types/vertex';
import { soldierCanAct } from '../utils/soldierActions';
import { roadAdjacentVertexIds } from '../utils/vertexAdjacency';

/**
 * Group-action state and handlers for the sidebar vertex panel.
 *
 * The player clicks their own soldiers in the mini map to assemble a group;
 * this hook tracks that selection, auto-selects actionable soldiers when the
 * vertex changes, decides which group actions (move/attack/capture/robber)
 * are available, and emits the socket calls. Group actions are only possible
 * during the player's own Action phase while no battle is running.
 */
export function useVertexGroup(board: Board, vertex: VertexNode, rules: SoldierActionRules) {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { healSoldier, moveSoldier, startAttack, captureSettlement, fightRobber } = useSocket();
  const {
    canMoveSoldierTo,
    canHealSoldierAt,
    canCaptureSettlementAt,
    canFightRobberAt,
  } = rules;

  // Group of soldier ids the player is assembling for a group action.
  const [selectedGroup, setSelectedGroup] = useState<string[]>([]);
  // The chosen defender when multiple enemy groups are on the target vertex.
  const [pendingAttack, setPendingAttack] = useState(false);

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

  // My garrisoned soldiers that still have their one action to spend this
  // phase — shown pulsing in the mini view so the player knows they can be used.
  const canActIds = new Set(
    groupActionsAllowed ? mySoldiersHere.filter((s) => soldierCanAct(s, turn)).map((s) => s.id) : []
  );

  // When the selected vertex changes, auto-select my soldiers on it that still
  // have their action to spend this phase, so the player can act on them
  // without manually picking each one.
  useEffect(() => {
    if (!groupActionsAllowed) {
      setSelectedGroup([]);
      return;
    }
    setSelectedGroup(mySoldiersHere.filter((s) => soldierCanAct(s, turn)).map((s) => s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertex.id]);

  // Move is available whenever the group can act; attack additionally requires
  // every member to be uninjured (injured state cannot attack — Rule 28).
  const groupReady = groupActionsAllowed && group.length > 0 && group.every((s) => soldierCanAct(s, turn));
  const canAttackGroup =
    groupActionsAllowed && group.length > 0 && group.every((s) => !s.injured && soldierCanAct(s, turn));
  // Capture is available when the group can act and the vertex holds a
  // settlement/city that is not yours, with no enemy or other troops there.
  const canCaptureGroup =
    groupActionsAllowed && group.length > 0 && group.every((s) => canCaptureSettlementAt(s.id, vertex.id));
  // The robber fight is 1v1 and once per player per Action phase, so it is
  // offered when any group member can fight; the first eligible soldier goes.
  const canFightRobberGroup = groupActionsAllowed && group.some((s) => canFightRobberAt(s.id, vertex.id));

  // Group members that can currently be healed (injured, own settlement, affordable).
  const healableSoldiers = groupActionsAllowed ? group.filter((s) => s.injured && canHealSoldierAt(s.id)) : [];

  // Vertices reachable from here via existing roads that every group member
  // can move to this phase.
  const moveTargets: VertexId[] = groupReady
    ? roadAdjacentVertexIds(board, vertex).filter((targetId) =>
        group.every((s) => canMoveSoldierTo(s.id, targetId))
      )
    : [];

  /** Enemy soldiers garrisoned on this vertex (the only valid attack target). */
  const enemyTroopsHere = Object.values(board.soldiers ?? {}).filter(
    (s) => s.vertexId === vertex.id && s.owner !== currentPlayer?.name
  );
  // Distinct enemy groups (owners) on this vertex — when there are 2 or
  // more, the attacker must choose which group to fight.
  const enemyGroups = Array.from(new Set(enemyTroopsHere.map((s) => s.owner)));

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

  return {
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
    cancelDefenderSelect: () => setPendingAttack(false),
  };
}
