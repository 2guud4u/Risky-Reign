import React from 'react';
import type { BuildCheck, VertexNode } from 'common';
import {
  CannonUpgradePrice,
  ExplosiveShotPrice,
  HealSoldierAmount,
  HealSoldierResources,
  SplashPrice,
  adjacentVertexIds,
  canMoveSoldierTo,
  cannonVertexId,
  moveCrossesWall,
  wallHitTarget,
} from 'common';
import { BubbleAction } from '../../components/board/ActionBubbles';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';
import { PriceText } from '../../utils/price';
import { directionAngleOf, directionOf, moveDirectionsFrom } from '../../utils/direction';
import { BoardActionsInput, ALLOWED } from './types';
import { firstAllowed, choiceGroup } from './helpers';
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
    actions.push(
      choiceGroup(
        {
          key: 'heal',
          icon: 'heal',
          label: `Heal ${injured.length}`,
          costText: `${HealSoldierAmount} each (pick resource)`,
          family: 'troops',
        },
        choices,
        { allowed: false, reason: 'Nothing to heal with' }
      )
    );
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
    actions.push(
      choiceGroup(
        {
          key: 'move',
          icon: 'move',
          label: `Move ${movable.length}`,
          costText: 'Pick a direction',
          family: 'troops',
        },
        choices,
        // No road out of this vertex means no direction at all to offer.
        { allowed: false, reason: 'No road leads out of here' }
      )
    );
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
    actions.push(
      choiceGroup(
        {
          key: 'attack',
          icon: 'attack',
          label: `Attack with ${group.length}`,
          costText: 'Pick who to attack',
          family: 'combat',
        },
        choices,
        { allowed: false, reason: 'No enemy to attack here' }
      )
    );
  }

  // Capture: a settlement/city here that isn't yours. A capture takes one
  // soldier, so the first picked soldier that may capture goes.
  const settlement = vertex.settlementId ? board.settlements[vertex.settlementId] : null;
  if (settlement && settlement.ownerId !== me.name) {
    const capturer = firstAllowed(group, (id) => rules.captureCheck(id, vertex.id));
    actions.push({
      key: 'capture',
      icon: 'capture',
      label: `Capture ${settlement.level}`,
      costText: '1 soldier',
      check: capturer.check,
      run: () => {
        if (!capturer.candidate) return;
        emit.captureSettlement(capturer.candidate, vertex.id);
        clearPicks();
      },
      family: 'combat',
    });
  }

  // Robber: a 1v1 fight, so the first picked soldier that may fight goes.
  if (vertex.hexIds.some((id) => board.hexes[id]?.robber)) {
    const fighter = firstAllowed(group, (id) => rules.fightRobberCheck(id, vertex.id));
    actions.push({
      key: 'robber',
      icon: 'robber',
      label: 'Fight the robber',
      costText: '1 soldier',
      check: fighter.check,
      run: () => {
        if (!fighter.candidate) return;
        emit.fightRobber(fighter.candidate, vertex.id);
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
      const upgrader = firstAllowed(infantry, rules.upgradeCannonCheck);
      const checks = infantry.map((id) => ({ id, check: rules.upgradeCannonCheck(id) }));
      actions.push({
        key: 'upgrade-cannon',
        icon: 'cannon',
        label: 'Upgrade to Cannon',
        costText: React.createElement(PriceText, { price: CannonUpgradePrice }),
        check: upgrader.check,
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
  const firstCannon = (runCheck: (soldierId: string) => BuildCheck) => {
    const { candidate, check } = firstAllowed(cannons, runCheck, {
      allowed: false,
      reason: 'No cannon picked',
    });
    return { id: candidate, check };
  };
  if (room.cannonsEnabled && cannons.length > 0) {
    // Station / unstation toggles the emplaced state (emplaced = can fire).
    const station = firstCannon((id) => rules.stationCannonCheck(id));
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
    const unstation = firstCannon((id) => rules.unstationCannonCheck(id));
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

    // Fire: shot-type submenu first — a level-2 "Single shot" or "Chain
    // shot" chip opens a level-3 aim stack. Single aims a compass chip per
    // target kind (enemies only; the cannon wins ties), one leaf per kind of
    // soldier in that direction. Chain (1 ore) aims at the vertex — here or
    // one intersection away — and hits every soldier there.
    const stationed = cannons.filter((id) => board.soldiers[id]?.stationed);
    if (stationed.length > 0) {
      const singleChips: BubbleAction[] = stationed.flatMap((cannonId) => {
        const from = board.vertices[cannonVertexId(board, board.soldiers[cannonId])];
        if (!from) return [];
        return adjacentVertexIds(board, from.id).flatMap((vid): BubbleAction[] => {
          const to = board.vertices[vid];
          const dir = to ? directionOf(from, to) : '';
          const angle = to ? directionAngleOf(from, to) : 0;
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
          return [...kinds.values()].map(({ first: t, count }) => ({
            key: `fire-${cannonId}-${t.id}`,
            icon: 'cannon' as const,
            label: count > 1 ? `${kindOf(t)} (${count})` : kindOf(t),
            costText: `${dir} · 1 action`,
            check: rules.cannonAttackCheck(cannonId, t.id),
            run: () => {
              emit.cannonAttack(cannonId, t.id);
              clearPicks();
            },
            eligible: true,
            direction: dir,
            angle,
            color: room.players.find((p) => p.name === t.owner)?.color,
          }));
        });
      });
      const chainChips: BubbleAction[] = stationed.flatMap((cannonId) => {
        const from = board.vertices[cannonVertexId(board, board.soldiers[cannonId])];
        if (!from) return [];
        // Chain shot can also land on the cannon's own vertex (the cannon is
        // immune; everyone else there takes a roll).
        const aims = [from.id, ...adjacentVertexIds(board, from.id)];
        return aims.map((vid): BubbleAction => {
          const to = board.vertices[vid];
          const dir = vid === from.id ? 'here' : to ? directionOf(from, to) : '';
          const angle = to && vid !== from.id ? directionAngleOf(from, to) : undefined;
          const check = rules.cannonSplashCheck(cannonId, vid);
          return {
            key: `fire-${cannonId}-chain-${vid}`,
            icon: 'cannon' as const,
            label: `Chain shot ${dir}`,
            costText: React.createElement(PriceText, { price: SplashPrice }),
            check,
            run: () => {
              emit.cannonSplash(cannonId, vid);
              clearPicks();
            },
            eligible: check.allowed,
            direction: vid === from.id ? undefined : dir,
            angle,
          };
        });
      });
      // Menu chips: a chip opens its aim stack only when its check allows —
      // when no aim is usable it stays a greyed pinned chip whose click
      // shows the first leaf's reason (ore short, no targets, action spent).
      const shotTypes: BubbleAction[] = [
        {
          key: 'fire-single',
          icon: 'cannon',
          label: 'Single shot',
          costText: 'duel one target · 1 action',
          check: singleChips.length > 0 ? ALLOWED : { allowed: false, reason: 'No target in range' },
          run: () => {},
          eligible: true,
          pinned: true,
          choices: singleChips,
        },
        {
          key: 'fire-chain',
          icon: 'cannon',
          label: 'Chain shot',
          costText: React.createElement(PriceText, { price: SplashPrice }),
          check: chainChips.find((c) => c.check.allowed)?.check ?? chainChips[0]?.check ?? ALLOWED,
          run: () => {},
          eligible: true,
          pinned: true,
          choices: chainChips,
        },
      ];
      const anyFire = singleChips.length > 0 || chainChips.some((c) => c.check.allowed);
      actions.push({
        key: 'fire',
        icon: 'cannon',
        label: 'Fire Cannon',
        costText: 'Pick a shot',
        check: anyFire ? ALLOWED : { allowed: false, reason: 'No valid target in range' },
        run: () => {},
        choices: shotTypes,
        family: 'artillery',
      });
    }

    // Wall attack: same shot-type shape — "Single shot" rolls to breach,
    // "Explosive shot" (1 ore) breaks the wall outright, no die needed.
    const walledEdges = (cannonId: string) => {
      const from = cannonVertexId(board, board.soldiers[cannonId]);
      return (board.vertices[from]?.roadIds ?? []).flatMap((edgeId) => {
        const edge = board.edges[edgeId];
        const road = edge?.roadId ? board.roads[edge.roadId] : undefined;
        if (!road?.isWall) return [];
        const other = edge.vertexAId === from ? edge.vertexBId : edge.vertexAId;
        const to = board.vertices[other];
        return [{ edgeId, road, dir: to ? directionOf(board.vertices[from], to) : '', angle: to ? directionAngleOf(board.vertices[from], to) : 0 }];
      });
    };
    const singleWallChips: BubbleAction[] = stationed.flatMap((cannonId) =>
      walledEdges(cannonId).map(({ edgeId, road, dir, angle }) => {
        const check = rules.cannonWallCheck(cannonId, edgeId);
        return {
          key: `wall-single-${cannonId}-${edgeId}`,
          icon: 'wall' as const,
          label: `Breach ${dir}`,
          costText: `roll ${wallHitTarget(room, road)}+ · 1 action`,
          check,
          run: () => {
            emit.cannonAttackWall(cannonId, edgeId, false);
            clearPicks();
          },
          eligible: check.allowed,
          direction: dir,
          angle,
        };
      })
    );
    const explosiveWallChips: BubbleAction[] = stationed.flatMap((cannonId) =>
      walledEdges(cannonId).map(({ edgeId, dir, angle }) => {
        const check = rules.cannonWallCheck(cannonId, edgeId, true);
        return {
          key: `wall-explosive-${cannonId}-${edgeId}`,
          icon: 'wall' as const,
          label: `Blast ${dir}`,
          costText: React.createElement(PriceText, { price: ExplosiveShotPrice }),
          check,
          run: () => {
            emit.cannonAttackWall(cannonId, edgeId, true);
            clearPicks();
          },
          eligible: check.allowed,
          direction: dir,
          angle,
        };
      })
    );
    if (singleWallChips.length > 0 || explosiveWallChips.length > 0) {
      actions.push(
        choiceGroup(
          {
            key: 'attack-wall',
            icon: 'wall',
            label: 'Attack Wall',
            costText: 'Pick a shot',
            family: 'artillery',
          },
          [
            {
              key: 'wall-shot-single',
              icon: 'cannon',
              label: 'Single shot',
              costText: 'roll to breach · 1 action',
              check: singleWallChips.find((c) => c.check.allowed)?.check ?? singleWallChips[0]?.check ?? ALLOWED,
              run: () => {},
              eligible: true,
              pinned: true,
              choices: singleWallChips,
            },
            {
              key: 'wall-shot-explosive',
              icon: 'cannon',
              label: 'Explosive shot',
              costText: React.createElement(PriceText, { price: ExplosiveShotPrice }),
              check:
                explosiveWallChips.find((c) => c.check.allowed)?.check ??
                explosiveWallChips[0]?.check ??
                ALLOWED,
              run: () => {},
              eligible: true,
              pinned: true,
              choices: explosiveWallChips,
            },
          ],
          { allowed: false, reason: 'No wall in range' }
        )
      );
    }

    // Downgrade back to infantry (anywhere, costs the action).
    const downgrade = firstCannon((id) => rules.downgradeCannonCheck(id));
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
      const boarder = firstAllowed(group, (id) => rules.embarkCheck(id, ship.id));
      const boarders = group.filter((id) => rules.embarkCheck(id, ship.id).allowed);
      actions.push({
        key: 'embark',
        icon: 'ship',
        label: boarders.length > 1 ? `Board Ship (${boarders.length})` : 'Board Ship',
        costText: '1 action each',
        check: boarder.check,
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
