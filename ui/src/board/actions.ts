import React, { useEffect } from 'react';
import {
  Board,
  BuildCheck,
  CannonUpgradePrice,
  CityPrice,
  EdgeNode,
  GameRoom,
  HealSoldierAmount,
  HealSoldierResources,
  Player,
  PublicGameRoom,
  PublicPlayer,
  ResourceKey,
  RoadPrice,
  SettlementPrice,
  ShipObj,
  ShipPrice,
  ShipSettlePrice,
  SoldierObj,
  SoldierPrice,
  SplashPrice,
  VertexNode,
  WallPrice,
  adjacentVertexIds,
  canBuildRoadOn,
  canBuildSettlementAt,
  canBuildShip,
  canCannonAttack,
  canCannonAttackWall,
  canCannonSplash,
  canCaptureSettlementAt,
  canConvertShipToSettlement,
  canDisembarkSoldier,
  canDowngradeCannon,
  canEmbarkSoldier,
  canFightRobber,
  canHealSoldierAt,
  canKnightSpawnAt,
  canMoveShip,
  canMoveSoldierTo,
  canPlaceSetupCityAt,
  canRecruitSoldierAt,
  canStartBattle,
  canStationCannon,
  canUnstationCannon,
  canUpgradeCannon,
  canUpgradeRoadToWall,
  canUpgradeSettlementToCity,
  cannonVertexId,
  isCoastVertex,
  isWaterVertex,
  moveCrossesWall,
  shipAt,
  troopsAboard,
} from 'common';
import { useGameActions, useGameState, useSelection } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { useSetupCoach } from '../hooks/useSetupCoach';
import { emitEffect } from '../effects';
import { actableSoldierIds, robberTargets } from './selectors';
import { directionAngleOf, directionOf, hexDirectionOf, moveDirectionsFrom } from '../utils/direction';
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
  upgradeCannon: (soldierId: string) => void;
  downgradeCannon: (soldierId: string) => void;
  stationCannon: (soldierId: string) => void;
  unstationCannon: (soldierId: string) => void;
  cannonAttack: (soldierId: string, targetSoldierId: string) => void;
  cannonSplash: (soldierId: string, vertexId: string) => void;
  cannonAttackWall: (soldierId: string, edgeId: string) => void;
  upgradeRoadToWall: (edgeId: string) => void;
  buildShip: (vertexId: string) => void;
  moveShip: (shipId: string, vertexId: string) => void;
  embarkSoldier: (soldierId: string, shipId: string) => void;
  disembarkSoldier: (soldierId: string, vertexId: string) => void;
  convertShipToSettlement: (shipId: string, vertexId: string) => void;
  /** Enter sail pick-mode for this ship (BoardView highlights the targets). */
  setSailingShipId: (shipId: string | null) => void;
  /** Fire flow: toggles chain shot (splash mode) on/off. */
  setChainShot: (on: boolean) => void;
}

/** One snapshot of everything the action catalog reads. */
export interface BoardActionsInput {
  board: Board;
  room: PublicGameRoom;
  /** The viewing player's seat (spectators have none → no actions). */
  me: PublicPlayer;
  selection: SelectableObject;
  selectedSoldierIds: string[];
  /** Whether chain shot is armed (splash mode for the Fire flow). */
  chainShot: boolean;
  /** The setup coach's current step, so its bubble can show the finger. */
  coachKey: 'settlement' | 'road' | null;
  emit: BoardActionEmit;
}

/** What a board selection resolved to against the live board. */
export type ResolvedSelection =
  | { kind: 'vertex'; vertex: VertexNode }
  | { kind: 'edge'; edge: EdgeNode }
  | { kind: 'ship'; ship: ShipObj }
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
  if (selection.type === 'ship') {
    const ship = board.ships[selection.id];
    return ship ? { kind: 'ship', ship } : null;
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
  upgradeCannonCheck: (soldierId: string) => BuildCheck;
  downgradeCannonCheck: (soldierId: string) => BuildCheck;
  stationCannonCheck: (soldierId: string) => BuildCheck;
  unstationCannonCheck: (soldierId: string) => BuildCheck;
  cannonAttackCheck: (soldierId: string, targetSoldierId: string) => BuildCheck;
  cannonSplashCheck: (soldierId: string, vertexId: string) => BuildCheck;
  cannonWallCheck: (soldierId: string, edgeId: string) => BuildCheck;
  wallCheck: (edgeId: string) => BuildCheck;
  buildShipCheck: (vertexId: string) => BuildCheck;
  moveShipCheck: (shipId: string, vertexId: string) => BuildCheck;
  embarkCheck: (soldierId: string, shipId: string) => BuildCheck;
  disembarkCheck: (soldierId: string, vertexId: string) => BuildCheck;
  convertShipCheck: (shipId: string, vertexId: string) => BuildCheck;
}

const makeRules = (room: PublicGameRoom, board: Board, me: PublicPlayer): BoardRules => {
  const turn = room.turnState;
  const name = me.name;
  const resources = me.resources;
  const hasFreeRoad = me.freeRoadsLeft > 0;
  const { asRoom, asMe } = asDomain(room, me);
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
    // The piece rules take the full GameRoom/Player; the public room and
    // this seat carry every field those checks read.
    upgradeCannonCheck: (soldierId) => canUpgradeCannon(asRoom, asMe, soldierId),
    downgradeCannonCheck: (soldierId) => canDowngradeCannon(asRoom, asMe, soldierId),
    stationCannonCheck: (soldierId) => canStationCannon(asRoom, asMe, soldierId),
    unstationCannonCheck: (soldierId) => canUnstationCannon(asRoom, asMe, soldierId),
    cannonAttackCheck: (soldierId, targetSoldierId) =>
      canCannonAttack(asRoom, asMe, soldierId, targetSoldierId),
    cannonSplashCheck: (soldierId, vertexId) =>
      canCannonSplash(asRoom, asMe, soldierId, vertexId),
    cannonWallCheck: (soldierId, edgeId) =>
      canCannonAttackWall(asRoom, asMe, soldierId, edgeId),
    wallCheck: (edgeId) => canUpgradeRoadToWall(asRoom, asMe, edgeId),
    buildShipCheck: (vertexId) => canBuildShip(asRoom, asMe, vertexId),
    moveShipCheck: (shipId, vertexId) => canMoveShip(asRoom, asMe, shipId, vertexId),
    embarkCheck: (soldierId, shipId) => canEmbarkSoldier(asRoom, asMe, soldierId, shipId),
    disembarkCheck: (soldierId, vertexId) =>
      canDisembarkSoldier(asRoom, asMe, soldierId, vertexId),
    convertShipCheck: (shipId, vertexId) =>
      canConvertShipToSettlement(asRoom, asMe, shipId, vertexId),
  };
};

/**
 * The piece rules are written against the server's `GameRoom`/`Player`; the
 * broadcast room and seat carry every field they read, so the cast is safe
 * and keeps the bubble checks identical to what the backend enforces.
 */
const asDomain = (room: PublicGameRoom, me: PublicPlayer) => ({
  asRoom: room as unknown as GameRoom,
  asMe: me as Player,
});

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
    if (room.shipsEnabled && rules.buildShipCheck(vertexId).allowed) return false;
  }
  for (const edgeId of Object.keys(board.edges)) {
    if (rules.roadCheck(edgeId).allowed) return false;
    if (room.wallsEnabled && rules.wallCheck(edgeId).allowed) return false;
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
    family: 'combat',
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
      family: 'combat',
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
      family: 'combat',
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
      family: 'combat',
    });
  }

  return actions;
};

/**
 * The Disembark bubble for troops aboard a ship: one chip per kind of troop
 * (type + health — identical troops are interchangeable, so "Land infantry"
 * twice would be noise). Troops land on the ship's own vertex, so each chip
 * lands the first such troop straight away.
 */
const disembarkAction = (
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
const shipActions = (
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
    const sailCheck: BuildCheck = probe
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
    const edgeActions: BubbleAction[] = [
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
    // Fortify an existing road into a wall (2 brick, Build phase, own road).
    const road = edge.roadId ? board.roads[edge.roadId] : null;
    if (room.wallsEnabled && road && !road.isWall && road.ownerId === me.name) {
      edgeActions.push({
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
    return edgeActions;
  }
  if (selected.kind === 'ship') {
    const ship = selected.ship;
    const vertex = board.vertices[ship.vertexId];
    const actableIds = vertex ? actableSoldierIds(room, me.name, vertex.id) : [];
    return [
      ...shipActions(input, ship, rules),
      // Aboard troops act from the ship's vertex (station/fire/splash etc.).
      ...(vertex && (room.cannonsEnabled || room.shipsEnabled)
        ? soldierActions(input, vertex, rules, actableIds)
        : []),
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
  const { selectedObject, selectedSoldierIds, chainShot } = useSelection();
  const { setSelectedSoldierIds, setSailingShipId, setChainShot } = useGameActions();
  const socket = useSocket();
  const coach = useSetupCoach(gameRoom?.board ?? null);

  // The vertex whose soldiers pre-pick on selection: the clicked vertex, or
  // the vertex a selected ship sits on (its troops act from there).
  const vertexId =
    selectedObject?.type === 'vertex'
      ? selectedObject.id
      : selectedObject?.type === 'ship'
        ? (gameRoom?.board?.ships[selectedObject.id]?.vertexId ?? null)
        : null;
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
    upgradeCannon: socket.upgradeCannon,
    downgradeCannon: socket.downgradeCannon,
    stationCannon: socket.stationCannon,
    unstationCannon: socket.unstationCannon,
    cannonAttack: socket.cannonAttack,
    cannonSplash: socket.cannonSplash,
    cannonAttackWall: socket.cannonAttackWall,
    upgradeRoadToWall: socket.upgradeRoadToWall,
    buildShip: socket.buildShip,
    moveShip: socket.moveShip,
    embarkSoldier: socket.embarkSoldier,
    disembarkSoldier: socket.disembarkSoldier,
    convertShipToSettlement: socket.convertShipToSettlement,
    setSailingShipId,
    setChainShot,
  };
  const actions = boardActions({
    board,
    room: gameRoom,
    me: currentPlayer,
    selection: selectedObject,
    selectedSoldierIds,
    chainShot,
    coachKey: coach?.key ?? null,
    emit,
  });
  const resetKey =
    selected.kind === 'robber' ? `robber-${selected.robberHexId}` : selectedObject.id;
  return { actions, resetKey };
}
