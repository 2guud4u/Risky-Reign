import { useEffect } from 'react';
import {
  Board,
  BuildCheck,
  HealSoldierAmount,
  HealSoldierResources,
  VertexNode,
  canMoveSoldierTo,
} from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { useBuildRules } from './useBuildRules';
import { actableSoldierIds } from '../utils/soldierActions';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import { moveDirectionsFrom } from '../utils/direction';

/** A sub-option of a group action (e.g. which resource to heal with). */
export interface SoldierActionChoice {
  key: string;
  /** Emoji shown on the choice button (direction arrows are SVG, not emoji). */
  icon: string;
  label: string;
  costText: string;
  /** The backend's own rule check for this choice: allowed, or why not. */
  check: BuildCheck;
  run: () => void;
  /** Eligible = the check passes; ineligible choices are hidden, not greyed. */
  eligible: boolean;
  /** Move choices only: compass direction (N / NE / … / NW). */
  direction?: string;
  /** Move choices only: arrow rotation in degrees (0 = up). */
  angle?: number;
}
/** One soldier group action available on the selected vertex. */
export interface SoldierAction {
  key: string;
  kind: 'move' | 'heal' | 'attack' | 'capture' | 'robber';
  label: string;
  costText: string;
  /** The shared rule check for the whole picked group: allowed, or why not. */
  check: BuildCheck;
  run: () => void;
  /**
   * Sub-options: the bubble expands into these instead of a confirm
   * (e.g. heal: pick Wheat or Sheep). Set only when the main bubble has
   * no direct action of its own.
   */
  choices?: SoldierActionChoice[];
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
  const { healSoldier, startAttack, captureSettlement, fightRobber, moveSoldier } = useSocket();
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

  // Heal: one bubble that splits into one choice per resource (Wheat /
  // Sheep); healing runs for every picked injured soldier.
  const injured = group.filter((id) => board.soldiers[id]?.injured);
  if (injured.length > 0) {
    const choices = HealSoldierResources.map((payWith) => {
      const have = currentPlayer.resources[payWith] ?? 0;
      const needed = injured.length * HealSoldierAmount;
      const ruleCheck =
        injured.map((id) => healSoldierCheck(id, payWith)).find((c) => !c.allowed) ?? ALLOWED;
      // Eligible = can pay for it AND the per-soldier rules allow it;
      // ineligible options are hidden, not greyed.
      const eligible = have >= needed && ruleCheck.allowed;
      const check =
        have < needed
          ? { allowed: false, reason: `Need ${needed} ${RESOURCE_ICONS[payWith]} to heal ${injured.length}` }
          : ruleCheck;
      return {
        key: `heal-${payWith}`,
        icon: RESOURCE_ICONS[payWith],
        label: `Heal ${injured.length} with ${payWith}`,
        costText: `${needed} ${RESOURCE_ICONS[payWith]}`,
        check,
        run: () => {
          for (const id of injured) healSoldier(currentPlayer.id, id, gameRoom.id, payWith);
          clearPicks();
        },
        eligible,
      };
    });
    // The heal bubble always shows while an injured soldier is picked; when
    // no resource is usable it is greyed with the reason instead.
    const anyEligible = choices.some((c) => c.eligible);
    actions.push({
      key: 'heal',
      kind: 'heal',
      label: `Heal ${injured.length}`,
      costText: `${HealSoldierAmount} each (pick resource)`,
      check: anyEligible ? ALLOWED : choices[0].check,
      run: () => {}, // expanded bubble: a choice is picked instead
      choices,
    });
  }

  // Move: the bubble shows while any picked soldier is movable; its pill
  // lists the compass directions (road-connected neighbors) at least one
  // picked soldier may move along. Confirming one moves every picked soldier
  // that can go that way (one action per soldier, per the backend rule).
  const turn = gameRoom.turnState;
  const movable = group.filter((id) => board.soldiers[id]?.owner === currentPlayer.name);
  if (movable.length > 0) {
    const directions = moveDirectionsFrom(board, vertex);
    const choices = directions
      .flatMap((d) => {
        const target = d.targets[0];
        if (!target) return [];
        const movers = movable.filter((id) => canMoveSoldierTo(board, turn, currentPlayer.name, id, target).allowed);
        return [
          {
            key: `move-${d.direction.toLowerCase()}`,
            icon: '', // direction arrows are SVG, not emoji
            label: `Move ${movers.length} to ${d.direction}`,
            costText: 'Action',
            check:
              movers.length > 0
                ? ALLOWED
                : { allowed: false, reason: 'No picked soldier can move this way' },
            run: () => {
              for (const id of movers) moveSoldier(currentPlayer.id, id, target, gameRoom.id);
              clearPicks();
            },
            eligible: movers.length > 0,
            direction: d.direction,
            angle: d.angle,
          },
        ];
      });
    const anyEligible = choices.some((c) => c.eligible);
    actions.push({
      key: 'move',
      kind: 'move',
      label: `Move ${movable.length}`,
      costText: 'Pick a direction',
      check: anyEligible ? ALLOWED : choices[0].check,
      run: () => {}, // expanded bubble: a direction is picked instead
      choices,
    });
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
