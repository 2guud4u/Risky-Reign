import { useEffect } from 'react';
import { Board, BuildCheck, HealSoldierAmount, HealSoldierResources, VertexNode } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { useBuildRules } from './useBuildRules';
import { actableSoldierIds } from '../utils/soldierActions';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

/** One soldier group action available on the selected vertex. */
export interface SoldierAction {
  key: string;
  kind: 'heal' | 'attack' | 'capture' | 'robber';
  label: string;
  costText: string;
  /** The shared rule check for the whole picked group: allowed, or why not. */
  check: BuildCheck;
  run: () => void;
}

const ALLOWED: BuildCheck = { allowed: true, reason: null };

/**
 * Soldier group actions for the selected vertex. The group is the player's
 * soldiers picked by tapping them on the map (`selectedSoldierIds` in the game
 * context); selecting a vertex pre-picks every soldier there that can still
 * act. Each action only appears when it is relevant here — an injured soldier
 * is picked (heal), enemy troops are here (attack, one per enemy player), a
 * foreign settlement is here (capture), the robber is next door (robber) — and
 * is greyed with the backend's reason when the group can't do it.
 */
export function useSoldierActions(board: Board, vertex: VertexNode): SoldierAction[] {
  const { gameRoom, currentPlayer, selectedSoldierIds, setSelectedSoldierIds } = useGameRoom();
  const { healSoldier, startAttack, captureSettlement, fightRobber } = useSocket();
  const { healSoldierCheck, attackCheck, captureCheck, fightRobberCheck } = useBuildRules(board);

  const playerName = currentPlayer?.name;
  const actableIds = actableSoldierIds(gameRoom, playerName, vertex.id);
  const canPick = actableIds.length > 0;

  // A newly selected vertex starts with every soldier that can act picked;
  // leaving it (or the Action phase ending) drops the picks.
  useEffect(() => {
    setSelectedSoldierIds(actableIds);
    return () => setSelectedSoldierIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertex.id, canPick]);

  if (!gameRoom || !currentPlayer || !canPick) return [];

  // Picks that are still valid (a soldier that just acted drops out).
  const group = selectedSoldierIds.filter((id) => actableIds.includes(id));
  if (group.length === 0) return [];

  const clearPicks = () => setSelectedSoldierIds([]);
  const actions: SoldierAction[] = [];

  // Heal: every picked injured soldier, paid with the chosen resource.
  const injured = group.filter((id) => board.soldiers[id]?.injured);
  if (injured.length > 0) {
    for (const payWith of HealSoldierResources) {
      const needed = injured.length * HealSoldierAmount;
      const have = currentPlayer.resources[payWith] ?? 0;
      const check =
        have < needed
          ? { allowed: false, reason: `Need ${needed} ${RESOURCE_ICONS[payWith]} to heal ${injured.length}` }
          : injured.map((id) => healSoldierCheck(id, payWith)).find((c) => !c.allowed) ?? ALLOWED;
      actions.push({
        key: `heal-${payWith}`,
        kind: 'heal',
        label: `Heal ${injured.length} with ${payWith}`,
        costText: `${needed} ${RESOURCE_ICONS[payWith]}`,
        check,
        run: () => {
          for (const id of injured) healSoldier(currentPlayer.id, id, gameRoom.id, payWith);
          clearPicks();
        },
      });
    }
  }

  // Attack: one action per enemy player garrisoned here.
  const enemyOwners = Array.from(
    new Set(
      Object.values(board.soldiers)
        .filter((s) => s.vertexId === vertex.id && s.owner !== playerName)
        .map((s) => s.owner)
    )
  );
  for (const defender of enemyOwners) {
    actions.push({
      key: `attack-${defender}`,
      kind: 'attack',
      label: `Attack ${defender} with ${group.length}`,
      costText: 'free',
      check: attackCheck(group, vertex.id, defender),
      run: () => {
        startAttack(currentPlayer.id, group, vertex.id, gameRoom.id, defender);
        clearPicks();
      },
    });
  }

  // Capture: a settlement/city here that isn't yours.
  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  if (settlement && settlement.ownerId !== playerName) {
    actions.push({
      key: 'capture',
      kind: 'capture',
      label: `Capture ${settlement.level}`,
      costText: 'free',
      check: group.map((id) => captureCheck(id, vertex.id)).find((c) => !c.allowed) ?? ALLOWED,
      run: () => {
        captureSettlement(currentPlayer.id, group, vertex.id, gameRoom.id);
        clearPicks();
      },
    });
  }

  // Robber: a 1v1 fight, so the first picked soldier that may fight goes.
  if (vertex.hexIds.some((id) => board.hexes[id]?.robber)) {
    const checks = group.map((id) => ({ id, check: fightRobberCheck(id, vertex.id) }));
    const fighter = checks.find((c) => c.check.allowed);
    actions.push({
      key: 'robber',
      kind: 'robber',
      label: 'Fight the robber',
      costText: '1 soldier',
      check: fighter ? ALLOWED : checks[0].check,
      run: () => {
        if (!fighter) return;
        fightRobber(currentPlayer.id, fighter.id, vertex.id, gameRoom.id);
        clearPicks();
      },
    });
  }

  return actions;
}
