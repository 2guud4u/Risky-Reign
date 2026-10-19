import React from 'react';
import type { BuildCheck, VertexNode } from 'common';
import {
  CannonUpgradePrice,
  HealSoldierAmount,
  HealSoldierResources,
  SplashPrice,
  adjacentVertexIds,
  canMoveSoldierTo,
  cannonVertexId,
  moveCrossesWall,
} from 'common';
import { BubbleAction } from '../../components/board/ActionBubbles';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';
import { PriceText } from '../../utils/price';
import { directionAngleOf, directionOf, moveDirectionsFrom } from '../../utils/direction';
import { BoardActionsInput, ALLOWED } from './types';
import { BoardRules } from './rules';
import { disembarkAction } from './ship';

/**
 * Soldier group bubbles for a vertex. The group is the player's soldiers
 * picked by tapping them on the map (`selectedSoldierIds`); selecting a
 * vertex pre-picks every soldier there that can still act (that effect lives
 * in `useBoardActions`). Each bubble appears only when it is relevant here —
 * an injured soldier is picked (heal), road-connected neighbors exist
 * (move), enemy troops are here (attack, one chip per enemy player), a
 * foreign settlement is here (capture), the robber is next door (robber) —
 * and is greyed with the backend's reason when the group can't do it.
 */
export const soldierActions = (
  input: BoardActionsInput,
  vertex: VertexNode,
  rules: BoardRules,
  actableIds: string[]
): BubbleAction[] => {
  const { room, board, me, emit } = input;
  const actions: BubbleAction[] = [];

  // Select/deselect every soldier that can act on this vertex; shown only
  // when there is more than one to pick. A plain toggle: it runs on the
  // first click (no expand/confirm step).
  if (actableIds.length >= 2) {
    const picked = input.selectedSoldierIds.filter((id) => actableIds.includes(id));
    const allSelected = picked.length === actableIds.length;
    actions.push({
      key: 'toggle-select-all-soldiers',
      icon: allSelected ? 'user' : 'users',
      label: allSelected ? 'Pick none' : `Pick all ${actableIds.length}`,
      costText: '',
      check: ALLOWED,
      run: () => emit.setSelectedSoldierIds(allSelected ? [] : actableIds),
      instant: true,
      family: 'troops',
    });
  }

  // Picks that are still valid (a soldier that just acted drops out).
  const group = input.selectedSoldierIds.filter((id) => actableIds.includes(id));
  if (group.length === 0) return actions;
  const clearPicks = () => emit.setSelectedSoldierIds([]);

  // Heal: one bubble that splits into one choice per resource (Wheat /
  // Sheep); healing runs for every picked injured soldier.
  const injured = group.filter((id) => board.soldiers[id]?.injured);
  if (injured.length > 0) {
    const choices: BubbleAction[] = HealSoldierResources.map((payWith) => {
      const have = me.resources[payWith] ?? 0;
      const needed = injured.length * HealSoldierAmount;
      const ruleCheck =
        injured.map((id) => rules.healSoldierCheck(id, payWith)).find((c) => !c.allowed) ?? ALLOWED;
      // Eligible = can pay for it AND the per-soldier rules allow it;
      // ineligible options are hidden, not greyed.
      const eligible = have >= needed && ruleCheck.allowed;
      const check =
        have < needed
          ? { allowed: false, reason: `Need ${needed} ${payWith} to heal ${injured.length}` }
          : ruleCheck;
      return {
        key: `heal-${payWith}`,
        icon: RESOURCE_ICONS[payWith],
        label: `Heal ${injured.length} with ${payWith}`,
        costText: `${needed} ${payWith}`,
        check,
        run: () => {
          for (const id of injured) emit.healSoldier(id, payWith);
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
      icon: 'heal',
      label: `Heal ${injured.length}`,
      costText: `${HealSoldierAmount} each (pick resource)`,
      check: anyEligible ? ALLOWED : choices[0]?.check ?? { allowed: false, reason: 'Nothing to heal with' },
      run: () => {}, // expanded bubble: a choice is picked instead
      choices,
      family: 'troops',
    });
  }

  // Move: the bubble shows while any picked soldier is movable; its pill
  // lists the compass directions (road-connected neighbors) at least one
  // picked soldier may move along. Confirming one moves every picked soldier
  // that can go that way (one action per soldier, per the backend rule).
  const turn = room.turnState;
  const movable = group.filter(
    (id) => board.soldiers[id]?.owner === me.name && board.soldiers[id]?.aboardShipId === null
  );
  if (movable.length > 0) {
    const directions = moveDirectionsFrom(board, vertex);
    const choices: BubbleAction[] = directions.flatMap((d) => {
      const target = d.targets[0];
      if (!target) return [];
      // An enemy wall gates one soldier at a time (the server refuses a move
      // while a gate is open), so a walled direction sends a single mover.
      const gateOpen = !!room.wallGate && room.wallGate.roll === null;
      const allowedMovers = gateOpen
        ? []
        : movable.filter((id) => canMoveSoldierTo(board, turn, me.name, id, target).allowed);
      const firstMover = allowedMovers[0] ? board.soldiers[allowedMovers[0]] : undefined;
      const walled = !!room.wallsEnabled && !!firstMover && !!moveCrossesWall(board, firstMover, target);
      const movers = walled ? allowedMovers.slice(0, 1) : allowedMovers;
      return [
        {
          key: `move-${d.direction.toLowerCase()}`,
          icon: 'move', // direction arrows are SVG, not emoji
          label: `Move ${movers.length} to ${d.direction}`,
          costText: d.direction,
          check:
            movers.length > 0
              ? ALLOWED
              : gateOpen
                ? { allowed: false, reason: 'A wall crossing is in progress' }
                : { allowed: false, reason: 'No picked soldier can move this way' },
          run: () => {
            for (const id of movers) emit.moveSoldier(id, target);
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
      icon: 'move',
      label: `Move ${movable.length}`,
      costText: 'Pick a direction',
      // No road out of this vertex means no direction at all to offer.
      check: anyEligible ? ALLOWED : choices[0]?.check ?? { allowed: false, reason: 'No road leads out of here' },
      run: () => {}, // expanded bubble: a direction is picked instead
      choices,
      family: 'troops',
    });
  }

  // Attack: one bubble that expands into a column of the enemies garrisoned
  // here, one named option per enemy.
  const enemyOwners = Array.from(
    new Set(
      Object.values(board.soldiers)
        .filter((s) => s.vertexId === vertex.id && s.owner !== me.name)
        .map((s) => s.owner)
    )
  );
  if (enemyOwners.length > 0) {
    const choices: BubbleAction[] = enemyOwners.map((defender) => {
      const check = rules.attackCheck(group, vertex.id, defender);
      return {
        key: `attack-${defender}`,
        icon: 'attack',
        label: defender,
        costText: 'free',
        check,
        run: () => {
          emit.startAttack(group, vertex.id, defender);
          clearPicks();
        },
        eligible: check.allowed,
        color: room.players.find((p) => p.name === defender)?.color,
      };
    });
    const anyEligible = choices.some((c) => c.eligible);
    actions.push({
      key: 'attack',
      icon: 'attack',
      label: `Attack with ${group.length}`,
      costText: 'Pick who to attack',
      check: anyEligible ? ALLOWED : choices[0]?.check ?? { allowed: false, reason: 'No enemy to attack here' },
      run: () => {}, // expanded bubble: an enemy is picked instead
      choices,
      family: 'combat',
    });
  }

  // Capture: a settlement/city here that isn't yours. A capture takes one
  // soldier, so the first picked soldier that may capture goes.
  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  if (settlement && settlement.ownerId !== me.name) {
    const checks = group.map((id) => ({ id, check: rules.captureCheck(id, vertex.id) }));
    const capturer = checks.find((c) => c.check.allowed);
    actions.push({
      key: 'capture',
      icon: 'capture',
      label: `Capture ${settlement.level}`,
      costText: '1 soldier',
      check: capturer ? ALLOWED : checks[0].check,
      run: () => {
        if (!capturer) return;
        emit.captureSettlement(capturer.id, vertex.id);
        clearPicks();
      },
      family: 'combat',
    });
  }

  // Robber: a 1v1 fight, so the first picked soldier that may fight goes.
  if (vertex.hexIds.some((id) => board.hexes[id]?.robber)) {
    const checks = group.map((id) => ({ id, check: rules.fightRobberCheck(id, vertex.id) }));
    const fighter = checks.find((c) => c.check.allowed);
    actions.push({
      key: 'robber',
      icon: 'robber',
      label: 'Fight the robber',
      costText: '1 soldier',
      check: fighter ? ALLOWED : checks[0].check,
      run: () => {
        if (!fighter) return;
        emit.fightRobber(fighter.id, vertex.id);
        clearPicks();
      },
      family: 'combat',
    });
  }

  // ── Cannons & ships (feature-gated; hidden entirely when disabled) ────

  // Upgrade: a picked infantry standing on my settlement may become a cannon
  // (1 wood + 1 ore, costs its action). Upgrade every eligible pick.
  if (room.cannonsEnabled) {
    const infantry = group.filter((id) => board.soldiers[id]?.type === 'infantry');
    if (infantry.length > 0) {
      const checks = infantry.map((id) => ({ id, check: rules.upgradeCannonCheck(id) }));
      actions.push({
        key: 'upgrade-cannon',
        icon: 'cannon',
        label: 'Upgrade to Cannon',
        costText: React.createElement(PriceText, { price: CannonUpgradePrice }),
        check: checks.find((c) => c.check.allowed)?.check ?? checks[0].check,
        run: () => {
          for (const c of checks.filter((c) => c.check.allowed)) emit.upgradeCannon(c.id);
          clearPicks();
        },
        family: 'artillery',
      });
    }
  }

  // Cannon orders, per picked cannon — a shot spends its action, so the
  // first picked cannon allowed to do it fires.
  const cannons = group.filter((id) => board.soldiers[id]?.type === 'cannon');
  const firstOk = (
    runCheck: (soldierId: string) => BuildCheck
  ): { id: string | null; check: BuildCheck } => {
    const checks = cannons.map((id) => ({ id, check: runCheck(id) }));
    const ok = checks.find((c) => c.check.allowed);
    return { id: ok?.id ?? null, check: ok?.check ?? checks[0]?.check ?? { allowed: false, reason: 'No cannon picked' } };
  };
  if (room.cannonsEnabled && cannons.length > 0) {
    // Station / unstation toggles the emplaced state (emplaced = can fire).
    const station = firstOk((id) => rules.stationCannonCheck(id));
    if (cannons.some((id) => !board.soldiers[id]?.stationed)) {
      actions.push({
        key: 'station',
        icon: 'cannon',
        label: 'Station Cannon',
        costText: '1 action',
        check: station.check,
        run: () => {
          if (station.id) emit.stationCannon(station.id);
          clearPicks();
        },
        family: 'artillery',
      });
    }
    const unstation = firstOk((id) => rules.unstationCannonCheck(id));
    if (cannons.some((id) => board.soldiers[id]?.stationed)) {
      actions.push({
        key: 'unstation',
        icon: 'move',
        label: 'Unstation Cannon',
        costText: '1 action',
        check: unstation.check,
        run: () => {
          if (unstation.id) emit.unstationCannon(unstation.id);
          clearPicks();
        },
        family: 'artillery',
      });
    }

    // Fire: direction-first aiming like Move — the pill opens with a chain-
    // shot toggle plus one compass chip per adjacent vertex that holds a
    // valid target. Single mode aims only at enemies (cannon wins ties);
    // chain mode loads splash (1 ore) and hits every soldier on the vertex.
    // A vertex with more than one shootable target opens a second chip level
    // to pick the soldier.
    const stationed = cannons.filter((id) => board.soldiers[id]?.stationed);
    if (stationed.length > 0) {
      const chain = input.chainShot;
      const fireChoices: BubbleAction[] = stationed.flatMap((cannonId) => {
        const from = board.vertices[cannonVertexId(board, board.soldiers[cannonId])];
        if (!from) return [];
        // Chain shot can also land on the cannon's own vertex (the cannon is
        // immune; everyone else there takes a roll).
        const here: BubbleAction[] = chain
          ? [
              {
                key: `fire-${cannonId}-${from.id}`,
                icon: 'cannon' as const,
                label: 'Chain shot here',
                costText: React.createElement(PriceText, { price: SplashPrice }),
                check: rules.cannonSplashCheck(cannonId, from.id),
                run: () => {
                  emit.cannonSplash(cannonId, from.id);
                  clearPicks();
                },
                eligible: rules.cannonSplashCheck(cannonId, from.id).allowed,
              },
            ]
          : [];
        return here.concat(adjacentVertexIds(board, from.id).flatMap((vid): BubbleAction[] => {
          const to = board.vertices[vid];
          const dir = to ? directionOf(from, to) : '';
          const angle = to ? directionAngleOf(from, to) : 0;
          if (chain) {
            // Chain shot: one shot into the whole vertex, friendlies
            // included — every soldier there takes a paired roll.
            const check = rules.cannonSplashCheck(cannonId, vid);
            return [
              {
                key: `fire-${cannonId}-${vid}`,
                icon: 'cannon' as const,
                label: `Chain shot ${dir}`,
                costText: React.createElement(PriceText, { price: SplashPrice }),
                check,
                run: () => {
                  emit.cannonSplash(cannonId, vid);
                  clearPicks();
                },
                eligible: check.allowed,
                direction: dir,
                angle,
              },
            ];
          }
          const shootable = Object.values(board.soldiers).filter(
            (t) => t.vertexId === vid && rules.cannonAttackCheck(cannonId, t.id).allowed
          );
          // Soldiers of the same owner, type and health are interchangeable
          // targets: one chip per kind (shooting the first), with a count.
          const kindOf = (t: (typeof shootable)[number]) =>
            `${t.owner}'s ${t.type === 'cannon' ? 'cannon' : t.injured ? 'injured soldier' : 'soldier'}`;
          const kinds = new Map<string, { first: (typeof shootable)[number]; count: number }>();
          for (const t of shootable) {
            const k = kindOf(t);
            const seen = kinds.get(k);
            if (seen) seen.count++;
            else kinds.set(k, { first: t, count: 1 });
          }
          const targets = [...kinds.values()];
          if (targets.length === 0) return [];
          const pick = ({ first: t, count }: (typeof targets)[number]): BubbleAction => ({
            key: `fire-${cannonId}-${t.id}`,
            icon: 'cannon' as const,
            label: count > 1 ? `${kindOf(t)} (${count})` : kindOf(t),
            costText: '1 action',
            check: rules.cannonAttackCheck(cannonId, t.id),
            run: () => {
              emit.cannonAttack(cannonId, t.id);
              clearPicks();
            },
            eligible: true,
            color: room.players.find((p) => p.name === t.owner)?.color,
          });
          if (targets.length === 1) {
            // One kind of target in that direction: fire it straight off the
            // direction chip, naming what it hits.
            const only = pick(targets[0]);
            return [{ ...only, label: `Fire ${dir}`, costText: `${only.label} · 1 action`, direction: dir, angle }];
          }
          return [
            {
              key: `fire-${cannonId}-${vid}`,
              icon: 'cannon' as const,
              label: `Aim ${dir}`,
              costText: `${targets.length} kinds of target`,
              check: ALLOWED,
              run: () => {},
              eligible: true,
              direction: dir,
              angle,
              choices: targets.map(pick),
            },
          ];
        }));
      });
      // The chain-shot toggle rides at the head of the pill; it stays shown
      // (greyed) when 1 ore isn't affordable so its price is discoverable.
      const canAffordChain = (me.resources.Ore ?? 0) >= SplashPrice.Ore;
      const chainToggle: BubbleAction = {
        key: 'fire-chain-shot',
        icon: 'cannon',
        label: 'Chain shot',
        costText: React.createElement(PriceText, { price: SplashPrice }),
        check: canAffordChain
          ? ALLOWED
          : { allowed: false, reason: 'Need 1 ore to load chain shot' },
        run: () => emit.setChainShot(!chain),
        eligible: canAffordChain,
        pinned: true,
        keepsOpen: true,
        active: chain,
        instant: true,
      };
      const choices = [chainToggle, ...fireChoices];
      const anyFire = fireChoices.some((c) => c.eligible);
      actions.push({
        key: 'fire',
        icon: 'cannon',
        label: 'Fire Cannon',
        costText: 'Aim one intersection away',
        check: anyFire ? ALLOWED : { allowed: false, reason: 'No valid target in range' },
        run: () => {},
        choices,
        family: 'combat',
      });
    }

    // Wall attack: a walled edge touching the cannon's effective vertex.
    const wallChoices: BubbleAction[] = stationed.flatMap((cannonId) => {
      const from = cannonVertexId(board, board.soldiers[cannonId]);
        return (board.vertices[from]?.roadIds ?? [])
          .filter((edgeId) => {
            const edge = board.edges[edgeId];
            const road = edge?.roadId ? board.roads[edge.roadId] : undefined;
            return !!road?.isWall;
          })
          .map((edgeId) => {
            const edge = board.edges[edgeId];
            const other = edge.vertexAId === from ? edge.vertexBId : edge.vertexAId;
            const to = board.vertices[other];
            const dir = to ? directionOf(board.vertices[from], to) : '';
            return {
              key: `wall-attack-${cannonId}-${edgeId}`,
              icon: 'wall' as const,
              label: `Breach wall ${dir}`,
              costText: '1 action · roll 4+',
              check: rules.cannonWallCheck(cannonId, edgeId),
              run: () => {
                emit.cannonAttackWall(cannonId, edgeId);
                clearPicks();
              },
              eligible: rules.cannonWallCheck(cannonId, edgeId).allowed,
              direction: dir,
              angle: to ? directionAngleOf(board.vertices[from], to) : 0,
            };
          });
      });
      const anyWall = wallChoices.some((c) => c.eligible);
      if (wallChoices.length > 0) {
        actions.push({
          key: 'attack-wall',
          icon: 'wall',
          label: 'Attack Wall',
          costText: '1 action · roll 4+ to breach',
          check: anyWall ? ALLOWED : wallChoices[0].check,
          run: () => {},
          family: 'artillery',
          choices: wallChoices,
        });
      }

    // Downgrade back to infantry (anywhere, costs the action).
    const downgrade = firstOk((id) => rules.downgradeCannonCheck(id));
    actions.push({
      key: 'downgrade-cannon',
      icon: 'recruit',
      label: 'Downgrade to Infantry',
      costText: '1 action',
      check: downgrade.check,
      run: () => {
        if (downgrade.id) emit.downgradeCannon(downgrade.id);
        clearPicks();
      },
      family: 'artillery',
    });
  }

  // Board ship: a picked soldier on foot boards the ship docked on this very
  // vertex (yours, or an empty one — boarding claims it).
  if (room.shipsEnabled) {
    const ship = board.ships && Object.values(board.ships).find((s) => s.vertexId === vertex.id);
    if (ship && group.some((id) => board.soldiers[id]?.aboardShipId === null)) {
      const boarders = group.filter((id) => rules.embarkCheck(id, ship.id).allowed);
      actions.push({
        key: 'embark',
        icon: 'ship',
        label: boarders.length > 1 ? `Board Ship (${boarders.length})` : 'Board Ship',
        costText: '1 action each',
        check: boarders.length > 0 ? ALLOWED : rules.embarkCheck(group[0], ship.id),
        run: () => {
          for (const id of boarders) emit.embarkSoldier(id, ship.id);
          clearPicks();
        },
        family: 'troops',
      });
    }

    // Disembark: a picked soldier aboard the ship lands on its vertex.
    const aboard = group.flatMap((id) => {
      const s = board.soldiers[id];
      return s && s.aboardShipId !== null ? [s] : [];
    });
    if (aboard.length > 0) {
      actions.push(disembarkAction(input, rules, aboard, 'troops'));
    }
  }

  return actions;
};
