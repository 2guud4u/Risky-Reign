import React from 'react';
import {
  ShipObj,
  ShipSettlePrice,
  SoldierObj,
  adjacentVertexIds,
  isCoastVertex,
  isWaterVertex,
  shipAt,
  troopsAboard,
} from 'common';
import { BubbleAction } from '../../components/board/ActionBubbles';
import { PriceText } from '../../utils/price';
import { BoardActionsInput, ALLOWED } from './types';
import { BoardRules } from './rules';

/**
 * The Disembark bubble for troops aboard a ship: one chip per kind of troop
 * (type + health — identical troops are interchangeable, so "Land infantry"
 * twice would be noise). Troops land on the ship's own vertex, so each chip
 * lands the first such troop straight away.
 */
export const disembarkAction = (
  input: BoardActionsInput,
  rules: BoardRules,
  troops: SoldierObj[],
  family: 'troops' | 'ship'
): BubbleAction => {
  const { board, emit } = input;
  const kinds = new Map<string, SoldierObj[]>();
  for (const s of troops) {
    const k = `${s.type === 'cannon' ? 'cannon' : s.injured ? 'injured soldier' : 'soldier'}`;
    kinds.set(k, [...(kinds.get(k) ?? []), s]);
  }
  const landingAt = (s: SoldierObj) => board.ships[s.aboardShipId!]?.vertexId ?? s.vertexId;
  const choices: BubbleAction[] = [...kinds].map(([kind, group]) => {
    const lander = group.find((s) => rules.disembarkCheck(s.id, landingAt(s)).allowed);
    return {
      key: `land-${group[0].id}`,
      icon: 'move' as const,
      label: group.length > 1 ? `Land ${kind} (${group.length})` : `Land ${kind}`,
      costText: '1 action',
      check: lander ? ALLOWED : rules.disembarkCheck(group[0].id, landingAt(group[0])),
      run: () => {
        if (lander) emit.disembarkSoldier(lander.id, landingAt(lander));
      },
      eligible: !!lander,
    };
  });
  const anyLand = choices.some((c) => c.eligible);
  return {
    key: 'disembark',
    icon: 'ship',
    label: `Disembark ${troops.length}`,
    costText: 'Pick who lands',
    check: anyLand ? ALLOWED : choices[0].check,
    run: () => {},
    choices,
    family,
  };
};

/**
 * Bubbles for a selected ship: sail it (pick-mode over reachable water
 * vertices), convert it to a settlement in Build phase, land troops on the
 * ship's vertex, plus the aboard soldiers' own group actions (station/fire)
 * produced by `soldierActions` on the ship's vertex.
 */
export const shipActions = (
  input: BoardActionsInput,
  ship: ShipObj,
  rules: BoardRules
): BubbleAction[] => {
  const { room, board, me, emit } = input;
  const actions: BubbleAction[] = [];
  const phase = room.turnState?.phase;
  const crew = troopsAboard(board, ship.id);
  const mine = ship.ownerId === me.name;
  const steps = room.turnState?.shipSteps?.[ship.id] ?? 0;

  // Sail: enter the pick-mode — BoardView highlights every water vertex the
  // ship can reach within its remaining steps and a click emits the hops.
  if (room.shipsEnabled && phase === 'Action') {
    // Probe the shared check against an adjacent water vertex for the most
    // precise reason when sailing is blocked.
    const probe = adjacentVertexIds(board, ship.vertexId).find(
      (vid) => isWaterVertex(board, vid) && !shipAt(board, vid)
    );
    const sailCheck = probe
      ? rules.moveShipCheck(ship.id, probe)
      : { allowed: false, reason: 'No water vertex next to this ship' };
    actions.push({
      key: 'sail',
      icon: 'ship',
      label: 'Sail',
      costText: `${steps} step${steps === 1 ? '' : 's'} left`,
      check: sailCheck,
      run: () => emit.setSailingShipId(ship.id),
      family: 'ship',
    });
  }

  // Convert to settlement: one chip per legal coast vertex (the ship's own
  // or an adjacent one), gated by the shared check.
  if (room.shipsEnabled && phase === 'Build' && mine) {
    const settleChoices: BubbleAction[] = [ship.vertexId, ...adjacentVertexIds(board, ship.vertexId)]
      .filter((vid) => isCoastVertex(board, vid))
      .map((vid) => ({
        key: `settle-${vid}`,
        icon: 'settlement' as const,
        label: 'This coast',
        costText: React.createElement(PriceText, { price: ShipSettlePrice }),
        check: rules.convertShipCheck(ship.id, vid),
        run: () => emit.convertShipToSettlement(ship.id, vid),
        eligible: rules.convertShipCheck(ship.id, vid).allowed,
      }));
    const anySettle = settleChoices.some((c) => c.eligible);
    actions.push({
      key: 'convert',
      icon: 'settlement',
      label: 'Settle Ship',
      costText: React.createElement(PriceText, { price: ShipSettlePrice }),
      check: anySettle
        ? ALLOWED
        : settleChoices[0]?.check ?? { allowed: false, reason: 'No coast vertex to settle on' },
      run: () => {},
      choices: settleChoices,
      family: 'ship',
    });
  }

  // Disembark: each troop aboard lands on the ship's vertex (own turn,
  // Action phase — the rule check decides the rest).
  if (room.shipsEnabled && phase === 'Action' && crew.length > 0) {
    const own = crew.filter((s) => s.owner === me.name);
    if (own.length > 0) actions.push(disembarkAction(input, rules, own, 'ship'));
  }
  return actions;
};
