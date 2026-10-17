import React, { useEffect } from 'react';
import {
  Board,
  BuildCheck,
  CityPrice,
  EdgeNode,
  HealSoldierAmount,
  HealSoldierResources,
  PublicGameRoom,
  PublicPlayer,
  ResourceKey,
  RoadPrice,
  SettlementPrice,
  SoldierPrice,
  VertexNode,
  canBuildRoadOn,
  canBuildSettlementAt,
  canCaptureSettlementAt,
  canFightRobber,
  canHealSoldierAt,
  canKnightSpawnAt,
  canMoveSoldierTo,
  canPlaceSetupCityAt,
  canRecruitSoldierAt,
  canStartBattle,
  canUpgradeSettlementToCity,
} from 'common';
import { useGameActions, useGameState, useSelection } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { useSetupCoach } from '../hooks/useSetupCoach';
import { emitEffect } from '../effects';
import { actableSoldierIds, robberTargets } from './selectors';
import { hexDirectionOf, moveDirectionsFrom } from '../utils/direction';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import { PriceText } from '../utils/price';
import { SelectableObject } from '../types';
import { BubbleAction } from '../components/board/ActionBubbles';
import { BuildType } from '../types/buildAnimation';

const ALLOWED: BuildCheck = { allowed: true, reason: null };
const NO_TURN: BuildCheck = { allowed: false, reason: 'No active turn' };

/**
 * Everything a bubble's `run` may need: the room-bound socket emits plus the
 * soldier pick setter. Injected so the catalog itself stays render-pure.
 */
export interface BoardActionEmit {
  buildSettlement: (vertexId: string, asCity?: boolean) => void;
  buildRoad: (edgeId: string) => void;
  upgradeSettlementToCity: (vertexId: string) => void;
  recruitSoldier: (vertexId: string) => void;
  moveSoldier: (soldierId: string, targetVertexId: string) => void;
  healSoldier: (soldierId: string, payWith?: ResourceKey) => void;
  startAttack: (soldierIds: string[], targetVertexId: string, defenderName?: string) => void;
  captureSettlement: (soldierId: string, vertexId: string) => void;
  fightRobber: (soldierId: string, vertexId: string) => void;
  moveRobberAfterWin: (hexId: string) => void;
  playDevelopmentCard: (cardIndex: number) => void;
  chooseKnightEffect: (effect: 'robber' | 'spawn' | 'cancel') => void;
  knightSpawnSoldier: (vertexId: string) => void;
  setSelectedSoldierIds: (ids: string[]) => void;
}

/** One snapshot of everything the action catalog reads. */
export interface BoardActionsInput {
  board: Board;
  room: PublicGameRoom;
  /** The viewing player's seat (spectators have none → no actions). */
  me: PublicPlayer;
  selection: SelectableObject;
  selectedSoldierIds: string[];
  /** The setup coach's current step, so its bubble can show the finger. */
  coachKey: 'settlement' | 'road' | null;
  emit: BoardActionEmit;
}

/** What a board selection resolved to against the live board. */
export type ResolvedSelection =
  | { kind: 'vertex'; vertex: VertexNode }
  | { kind: 'edge'; edge: EdgeNode }
  | { kind: 'robber'; robberHexId: string };

/**
 * Resolve a raw board selection to the live object it names (or the hex the
 * robber sits on — its id, not the selected id, is what matters). Returns
 * null when the selection is stale.
 */
export function resolveSelection(
  board: Board,
  selection: SelectableObject
): ResolvedSelection | null {
  if (selection.type === 'vertex') {
    const vertex = board.vertices[selection.id];
    return vertex ? { kind: 'vertex', vertex } : null;
  }
  if (selection.type === 'edge') {
    const edge = board.edges[selection.id];
    return edge ? { kind: 'edge', edge } : null;
  }
  const robber = Object.values(board.hexes).find((h) => h.robber);
  return robber ? { kind: 'robber', robberHexId: robber.id } : null;
}

/**
 * The eligibility rules the bubbles report, delegating to the authoritative
 * checks in `common` (the same functions the backend enforces), so the UI's
 * "can I build?" hints can never drift from the server's rules.
 */
interface BoardRules {
  /** A played Road Building card makes the next roads free (cost + spend animation skip). */
  hasFreeRoad: boolean;
  settlementCheck: (vertexId: string) => BuildCheck;
  /** Setup only: place a city directly (room's setupCities setting). */
  setupCityCheck: (vertexId: string) => BuildCheck;
  /** A free road from a played Road Building card skips the resource cost. */
  roadCheck: (edgeId: string) => BuildCheck;
  cityCheck: (vertexId: string) => BuildCheck;
  soldierCheck: (vertexId: string) => BuildCheck;
  healSoldierCheck: (soldierId: string, payWith?: ResourceKey) => BuildCheck;
  captureCheck: (soldierId: string, vertexId: string) => BuildCheck;
  fightRobberCheck: (soldierId: string, vertexId: string) => BuildCheck;
  attackCheck: (soldierIds: string[], vertexId: string, defenderName?: string) => BuildCheck;
}

const makeRules = (room: PublicGameRoom, board: Board, me: PublicPlayer): BoardRules => {
  const turn = room.turnState;
  const name = me.name;
  const resources = me.resources;
  const hasFreeRoad = me.freeRoadsLeft > 0;
  return {
    hasFreeRoad,
    settlementCheck: (vertexId) =>
      turn ? canBuildSettlementAt(board, turn, name, vertexId, resources) : NO_TURN,
    setupCityCheck: (vertexId) =>
      turn ? canPlaceSetupCityAt(board, turn, name, vertexId, room.setupCities) : NO_TURN,
    roadCheck: (edgeId) =>
      turn
        ? canBuildRoadOn(board, turn, name, edgeId, resources, hasFreeRoad)
        : NO_TURN,
    cityCheck: (vertexId) =>
      turn ? canUpgradeSettlementToCity(board, turn, name, vertexId, resources) : NO_TURN,
    soldierCheck: (vertexId) =>
      turn ? canRecruitSoldierAt(board, turn, name, vertexId, resources) : NO_TURN,
    healSoldierCheck: (soldierId, payWith) =>
      turn ? canHealSoldierAt(board, turn, name, soldierId, resources, payWith) : NO_TURN,
    captureCheck: (soldierId, vertexId) =>
      turn ? canCaptureSettlementAt(board, turn, name, soldierId, vertexId) : NO_TURN,
    // The battle checks report `reason?: string`; normalize to BuildCheck.
    fightRobberCheck: (soldierId, vertexId) => {
      const { allowed, reason } = canFightRobber(room, name, soldierId, vertexId);
      return { allowed, reason: reason ?? null };
    },
    attackCheck: (soldierIds, vertexId, defenderName) => {
      if (room.battleState) return { allowed: false, reason: 'A battle is already in progress' };
      const { allowed, reason } = canStartBattle(room, name, soldierIds, vertexId, defenderName);
      return { allowed, reason: reason ?? null };
    },
  };
};

/**
 * Nothing at all can be built this Build phase: no vertex takes a
 * settlement or city, and no edge takes a road (free Road Building roads
 * count). Used for the "end your turn" hint finger; the per-spot checks are
 * the same authoritative ones the bubbles use.
 */
export function nothingBuildable(room: PublicGameRoom, me: PublicPlayer): boolean {
  const board = room.board;
  const turn = room.turnState;
  if (!board || !turn || turn.phase !== 'Build') return false;
  const rules = makeRules(room, board, me);
  for (const vertexId of Object.keys(board.vertices)) {
    if (rules.settlementCheck(vertexId).allowed || rules.cityCheck(vertexId).allowed) return false;
  }
  for (const edgeId of Object.keys(board.edges)) {
    if (rules.roadCheck(edgeId).allowed) return false;
  }
  return true;
}

/**
 * Build bubbles for a vertex — build settlement, upgrade to city, recruit
 * soldier, or (while a played Knight awaits its spawn) spawn the knight's
 * free soldier. Only what can apply to this corner at all is offered; a
 * bubble that is shown can still be greyed — not enough cards, distance
 * rule, piece limit, setup cities used up — and expanding it shows why.
 */
const vertexBuildActions = (input: BoardActionsInput, vertex: VertexNode, rules: BoardRules) => {
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
    });
  }
  return actions;
};

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
const soldierActions = (
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
    });
  }

  // Move: the bubble shows while any picked soldier is movable; its pill
  // lists the compass directions (road-connected neighbors) at least one
  // picked soldier may move along. Confirming one moves every picked soldier
  // that can go that way (one action per soldier, per the backend rule).
  const turn = room.turnState;
  const movable = group.filter((id) => board.soldiers[id]?.owner === me.name);
  if (movable.length > 0) {
    const directions = moveDirectionsFrom(board, vertex);
    const choices: BubbleAction[] = directions.flatMap((d) => {
      const target = d.targets[0];
      if (!target) return [];
      const movers = movable.filter(
        (id) => canMoveSoldierTo(board, turn, me.name, id, target).allowed
      );
      return [
        {
          key: `move-${d.direction.toLowerCase()}`,
          icon: 'move', // direction arrows are SVG, not emoji
          label: `Move ${movers.length} to ${d.direction}`,
          costText: d.direction,
          check:
            movers.length > 0
              ? ALLOWED
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
    });
  }

  return actions;
};

/** A short label for a vertex next to the robber: its other hex tokens. */
const vertexLabel = (board: Board, vertexId: string, robberHexId: string): string => {
  const tokens =
    board.vertices[vertexId]?.hexIds
      .filter((id) => id !== robberHexId)
      .map((id) => board.hexes[id])
      .map((h) => (h && h.rollNumber != null ? `${h.rollNumber} ${h.terrain}` : null))
      .filter(Boolean) ?? [];
  return tokens.length > 0 ? tokens.join(' ') : 'this vertex';
};

/**
 * The robber's own bubbles (click the robber on the map):
 * - Attack: a 1v1 robber fight, expanded as a column — one chip per vertex
 *   next to the robber where one of your soldiers can fight. Greyed with the
 *   backend's reason when nobody can.
 * - Move: with a pending move (rolled 7, played Knight, won fight) one click
 *   zooms the board out so every highlighted target hex fits; after a won
 *   fight the move is one-hex-only, so it expands into direction chips like
 *   a soldier move; otherwise it confirms spending a Knight card for the
 *   same move. Greyed when neither applies.
 */
const robberActions = (
  input: BoardActionsInput,
  robberHexId: string,
  rules: BoardRules
): BubbleAction[] => {
  const { room, board, me, emit } = input;
  const actions: BubbleAction[] = [];

  const name = me.name;
  const turn = room.turnState;
  const isMyTurn = turn.player === name;
  const robberPending = room.robberMove?.player === name;
  const winPending = room.robberDefeatedBy?.playerName === name;

  // ---- Attack (1v1 robber fight) ----
  // Candidates: my soldiers on any vertex touching the robber's hex.
  const adjacentVertexIds = Object.values(board.vertices)
    .filter((v) => v.hexIds.includes(robberHexId))
    .map((v) => v.id);
  const perVertex = adjacentVertexIds
    .map((vertexId) => {
      const ids = actableSoldierIds(room, name, vertexId);
      const fighter = ids.find((id) => rules.fightRobberCheck(id, vertexId).allowed);
      return {
        vertexId,
        fighter,
        firstCheck: ids.length > 0 ? rules.fightRobberCheck(ids[0], vertexId) : null,
      };
    })
    .filter((v) => v.fighter || v.firstCheck);
  const fightChoices: BubbleAction[] = perVertex
    .filter((v) => v.fighter)
    .map((v) => ({
      key: `attack-${v.vertexId}`,
      icon: 'attack',
      label: vertexLabel(board, v.vertexId, robberHexId),
      costText: '1 soldier',
      check: ALLOWED,
      run: () => emit.fightRobber(v.fighter!, v.vertexId),
      eligible: true,
    }));
  const fightCheck: BuildCheck = fightChoices.length
    ? ALLOWED
    : winPending
      ? { allowed: false, reason: 'You won — move the robber one hex over' }
      : room.battleState
        ? { allowed: false, reason: 'A battle is already in progress' }
        : turn.phase !== 'Action'
          ? { allowed: false, reason: 'Can only fight the robber during Action phase' }
          : !isMyTurn
            ? { allowed: false, reason: 'Not your turn to act' }
            : adjacentVertexIds.every((v) => actableSoldierIds(room, name, v).length === 0)
              ? { allowed: false, reason: 'None of your soldiers is next to the robber' }
              : perVertex.find((v) => v.firstCheck)?.firstCheck ??
                { allowed: false, reason: 'No soldier can fight the robber' };
  actions.push({
    key: 'attack',
    icon: 'attack',
    label: 'Attack',
    costText: 'Pick a soldier to fight',
    check: fightCheck,
    run: () => {}, // expanded bubble: a soldier is picked instead
    choices: fightChoices,
  });

  // ---- Move ----
  if (winPending) {
    // After defeating the robber it can only move ONE hex over (Rule:
    // "move robber 1 tile away of their choosing") — so the bubble expands
    // into direction-arrow chips like a soldier move, one per legal target.
    const defeated = room.robberDefeatedBy!;
    const moveChoices: BubbleAction[] = robberTargets(board, defeated.fromHexId)
      .map((hexId) => {
        const hex = board.hexes[hexId];
        const { direction, angle } = hexDirectionOf(
          board.hexes[defeated.fromHexId].coord,
          hex.coord
        );
        const where = `${hex.terrain}${hex.rollNumber !== null ? ` ${hex.rollNumber}` : ''}`;
        return {
          key: `robber-move-${hexId}`,
          icon: 'robber', // direction arrows are SVG, not emoji
          label: `Move robber ${direction} to ${where}`,
          costText: `${direction} · ${where}`,
          check: ALLOWED,
          run: () => emit.moveRobberAfterWin(hexId),
          eligible: true,
          direction,
          angle,
        };
      });
    actions.push({
      key: 'move',
      icon: 'robber',
      label: 'Move',
      costText: 'Pick a direction',
      check: moveChoices.length ? ALLOWED : { allowed: false, reason: 'No legal hex next to the robber' },
      run: () => emitEffect('boardFit'),
      choices: moveChoices,
    });
  } else if (robberPending) {
    // Rolled 7 or played Knight: any hex is legal — no direction list can
    // cover that, so the bubble just zooms out to the highlighted targets.
    actions.push({
      key: 'move',
      icon: 'robber',
      label: 'Move',
      costText: 'Pick a highlighted hex',
      check: ALLOWED,
      run: () => emitEffect('boardFit'),
    });
  } else {
    const cards = me.developmentCards;
    const knightIndex = cards.findIndex(
      (card, i) => card === 'knight' && i < cards.length - me.devCardsBoughtThisTurn
    );
    const moveCheck: BuildCheck =
      !isMyTurn
        ? { allowed: false, reason: 'Only on your turn' }
        : room.battleState
          ? { allowed: false, reason: 'A battle is already in progress' }
          : room.devCardChoice
            ? { allowed: false, reason: 'Resolve your card choice first' }
            : knightIndex === -1
              ? { allowed: false, reason: 'You need a Knight card to move the robber' }
              : ALLOWED;
    actions.push({
      key: 'move',
      icon: 'robber',
      label: 'Move',
      costText: 'Knight card',
      check: moveCheck,
      run: () => {
        if (knightIndex === -1) return;
        // Play the Knight, pick its robber effect, then zoom out to the
        // highlighted targets (server ordering makes the choice legal).
        emit.playDevelopmentCard(knightIndex);
        emit.chooseKnightEffect('robber');
        emitEffect('boardFit');
      },
    });
  }

  return actions;
};

/**
 * The one action catalog: every bubble a selection can show, produced as
 * `BubbleAction` descriptors for `ActionBubbles`. All gates live here — the
 * spectate/selection gate (via `useBoardActions`), the per-action phase
 * checks, and the shared rule checks — so the descriptor is the single
 * source of truth for what's offered, greyed, or hidden.
 */
export function boardActions(input: BoardActionsInput): BubbleAction[] {
  const { board, room, me, selection, emit } = input;
  const rules = makeRules(room, board, me);
  const selected = resolveSelection(board, selection);
  if (!selected) return [];

  if (selected.kind === 'vertex') {
    const vertex = selected.vertex;
    const actableIds = actableSoldierIds(room, me.name, vertex.id);
    return [
      ...vertexBuildActions(input, vertex, rules),
      ...soldierActions(input, vertex, rules, actableIds),
    ];
  }
  if (selected.kind === 'edge') {
    const edge = selected.edge;
    const check = rules.roadCheck(edge.id);
    return [
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
      },
    ];
  }
  return robberActions(input, selected.robberHexId, rules);
}

/**
 * The hook form of `boardActions`: wires the contexts, owns the "a newly
 * selected vertex starts with every actable soldier picked" effect, and
 * reports the `resetKey` (selection identity) that collapses an expanded
 * bubble when the selection changes. Returns null when there is nothing to
 * show — no room/board, spectating, or a stale selection.
 */
export function useBoardActions(): { actions: BubbleAction[]; resetKey: string } | null {
  const { gameRoom, currentPlayer } = useGameState();
  const { selectedObject, selectedSoldierIds } = useSelection();
  const { setSelectedSoldierIds } = useGameActions();
  const socket = useSocket();
  const coach = useSetupCoach(gameRoom?.board ?? null);

  const vertexId = selectedObject?.type === 'vertex' ? selectedObject.id : null;
  const actableIds = actableSoldierIds(gameRoom, currentPlayer?.name, vertexId);
  const canPick = actableIds.length > 0;

  // A newly selected vertex starts with every soldier that can act picked;
  // leaving it (or the Action phase ending) drops the picks.
  useEffect(() => {
    if (!vertexId || !currentPlayer) return;
    setSelectedSoldierIds(actableIds);
    return () => setSelectedSoldierIds([]);
    // The picks belong to the vertex + whether any soldier is pickable, not
    // to the changing actableIds array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertexId, canPick]);

  if (!gameRoom?.board || !currentPlayer || !selectedObject) return null;
  const board = gameRoom.board;
  const selected = resolveSelection(board, selectedObject);
  if (!selected) return null;

  const emit: BoardActionEmit = {
    buildSettlement: socket.buildSettlement,
    buildRoad: socket.buildRoad,
    upgradeSettlementToCity: socket.upgradeSettlementToCity,
    recruitSoldier: socket.recruitSoldier,
    moveSoldier: socket.moveSoldier,
    healSoldier: socket.healSoldier,
    startAttack: socket.startAttack,
    captureSettlement: socket.captureSettlement,
    fightRobber: socket.fightRobber,
    moveRobberAfterWin: socket.moveRobberAfterWin,
    playDevelopmentCard: socket.playDevelopmentCard,
    chooseKnightEffect: socket.chooseKnightEffect,
    knightSpawnSoldier: socket.knightSpawnSoldier,
    setSelectedSoldierIds,
  };
  const actions = boardActions({
    board,
    room: gameRoom,
    me: currentPlayer,
    selection: selectedObject,
    selectedSoldierIds,
    coachKey: coach?.key ?? null,
    emit,
  });
  const resetKey =
    selected.kind === 'robber' ? `robber-${selected.robberHexId}` : selectedObject.id;
  return { actions, resetKey };
}
