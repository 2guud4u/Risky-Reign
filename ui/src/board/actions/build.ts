import React from 'react';
import type { EdgeNode, VertexNode } from 'common';
import {
  CityPrice,
  SettlementPrice,
  ShipPrice,
  SoldierPrice,
  WallPrice,
  RoadPrice,
  canKnightSpawnAt,
  isCoastVertex,
} from 'common';
import { emitEffect } from '../../effects';
import { PriceText } from '../../utils/price';
import { BubbleAction } from '../../components/board/ActionBubbles';
import { BuildType } from '../../types/buildAnimation';
import { BoardActionsInput } from './types';
import { BoardRules } from './rules';

/**
 * Build bubbles for a vertex — build settlement, upgrade to city, recruit
 * soldier, or (while a played Knight awaits its spawn) spawn the knight's
 * free soldier. Only what can apply to this corner at all is offered; a
 * bubble that is shown can still be greyed — not enough cards, distance
 * rule, piece limit, setup cities used up — and expanding it shows why.
 */
export const vertexBuildActions = (input: BoardActionsInput, vertex: VertexNode, rules: BoardRules) => {
  const { room, me, emit } = input;
  const phase = room.turnState?.phase;
  const actions: BubbleAction[] = [];
  const setup = phase === 'SetUp';

  const send =
    (sendFn: (vertexId: string, asCity?: boolean) => void, type: BuildType, asCity?: boolean) =>
    () => {
      sendFn(vertex.id, asCity);
      emitEffect('buildAnimation', { type, locationId: vertex.id });
    };

  // A played Knight waiting for its spawn: offer it on this vertex.
  const choice = room.devCardChoice;
  if (choice?.card === 'knight' && choice.spawn && choice.player === me.name) {
    actions.push({
      key: 'knight',
      icon: 'knight',
      label: 'Knight: Spawn Soldier',
      costText: 'Knight card',
      check: canKnightSpawnAt(input.board, me.name, vertex.id),
      run: () => emit.knightSpawnSoldier(vertex.id),
      family: 'build',
      closeOnRun: true,
    });
  }

  const settlement = vertex.settlementId ? input.board.settlements[vertex.settlementId] : null;
  const mine = !!settlement && settlement.ownerId === me.name;
  if ((phase === 'SetUp' || phase === 'Build') && !settlement) {
    const check = rules.settlementCheck(vertex.id);
    actions.push({
      key: 'settlement',
      icon: 'settlement',
      label: 'Build Settlement',
      costText: setup ? 'Free' : React.createElement(PriceText, { price: SettlementPrice }),
      check,
      run: send(emit.buildSettlement, 'settlement'),
      // The tutorial finger points at this bubble while the coach suggests
      // placing a settlement.
      coach: input.coachKey === 'settlement' && check.allowed,
      closeOnRun: true,
      family: 'build',
    });
  }
  if (setup && !settlement && room.setupCities > 0) {
    actions.push({
      key: 'setupCity',
      icon: 'city',
      label: 'Place City',
      costText: 'Free',
      check: rules.setupCityCheck(vertex.id),
      run: send(emit.buildSettlement, 'city', true),
      closeOnRun: true,
      family: 'build',
    });
  }
  if (phase === 'Build' && mine && settlement.level === 'settlement') {
    actions.push({
      key: 'city',
      icon: 'city',
      label: 'Upgrade to City',
      costText: React.createElement(PriceText, { price: CityPrice }),
      check: rules.cityCheck(vertex.id),
      run: send(emit.upgradeSettlementToCity, 'city'),
      closeOnRun: true,
      family: 'build',
    });
  }
  if (phase === 'Action' && mine) {
    actions.push({
      key: 'soldier',
      icon: 'recruit',
      label: 'Recruit Soldier',
      costText: React.createElement(PriceText, { price: SoldierPrice }),
      check: rules.soldierCheck(vertex.id),
      run: send(emit.recruitSoldier, 'soldier'),
      // Recruiting keeps the corner selected so you can recruit again or act.
      family: 'build',
    });
  }

  // Ships anchor on coast vertices touched by your road or settlement; the
  // check itself gates the flag, phase, reachability and the 1w+1s cost.
  if (room.shipsEnabled && phase === 'Build' && isCoastVertex(input.board, vertex.id) && !settlement) {
    actions.push({
      key: 'ship',
      icon: 'ship',
      label: 'Build Ship',
      costText: React.createElement(PriceText, { price: ShipPrice }),
      check: rules.buildShipCheck(vertex.id),
      run: send(emit.buildShip, 'ship'),
      closeOnRun: true,
      family: 'build',
    });
  }
  return actions;
};

/**
 * Edge bubbles: build a road, or fortify an existing road into a wall (2
 * brick, Build phase, own road).
 */
export const edgeBuildActions = (input: BoardActionsInput, edge: EdgeNode, rules: BoardRules) => {
  const { room, board, me, emit } = input;
  const check = rules.roadCheck(edge.id);
  const actions: BubbleAction[] = [
    {
      key: 'road',
      icon: 'build',
      label: 'Build Road',
      costText:
        room.turnState?.phase === 'SetUp'
          ? 'Free'
          : rules.hasFreeRoad
            ? 'Free (Road Building)'
            : React.createElement(PriceText, { price: RoadPrice }),
      check,
      run: () => {
        emit.buildRoad(edge.id);
        // A free (Road Building) road spends nothing, so nothing flies.
        if (!rules.hasFreeRoad) {
          emitEffect('buildAnimation', { type: 'road', locationId: edge.id });
        }
      },
      coach: input.coachKey === 'road' && check.allowed,
      closeOnRun: true,
      family: 'build',
    },
  ];
  const road = edge.roadId ? board.roads[edge.roadId] : null;
  if (room.wallsEnabled && road && !road.isWall && road.ownerId === me.name) {
    actions.push({
      key: 'wall',
      icon: 'wall',
      label: 'Build Wall',
      costText: React.createElement(PriceText, { price: WallPrice }),
      check: rules.wallCheck(edge.id),
      run: () => {
        emit.upgradeRoadToWall(edge.id);
        emitEffect('buildAnimation', { type: 'wall', locationId: edge.id });
      },
      closeOnRun: true,
      family: 'build',
    });
  }
  return actions;
};
