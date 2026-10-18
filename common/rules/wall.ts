/**
 * Wall rules — the full rule, not just the check half.
 *
 * A wall is a flag on a `RoadObj` (`isWall`): the road still exists, but an
 * enemy soldier crossing that edge is held at the gate — `moveSoldier` does
 * not move; the action layer opens a `wallGate` pending instead (the crosser
 * guesses 1-6, the wall owner rolls a d6; match = cross, miss = stay — the
 * soldier's action is spent either way). The owner's own soldiers cross
 * freely.
 */
import type { Board, EdgeId, RoadId, VertexId } from '../types/Board';
import type { BuildCheck } from '../types/Logic';
import type { Player } from '../types/Player';
import type { GameRoom } from '../types/Room';
import type { SoldierObj } from '../types/Pieces';
import { WallPrice } from '../Constant';
import { canAfford } from '../utils/logic';
import { subtractPrice } from '../utils/trade';

const pass: BuildCheck = { allowed: true, reason: null };
const fail = (reason: string): BuildCheck => ({ allowed: false, reason });

/**
 * The road on `edgeId` when it is an enemy wall to `playerName`, else null.
 * Shared by the move layer (does this edge gate?) and the capture flood-fill.
 */
export function enemyWallRoadAt(board: Board, edgeId: EdgeId, playerName: string): RoadId | null {
  const edge = board.edges[edgeId];
  const road = edge?.roadId ? board.roads[edge.roadId] : undefined;
  return road?.isWall && road.ownerId !== playerName ? road.id : null;
}

/**
 * Does moving `soldier` onto `targetVertexId` cross an enemy wall? Returns
 * the gate context for the pending (the edge and its owner) or null when the
 * crossing is free — own walls never gate. Pure geometry; the action layer
 * decides to open the pending instead of moving.
 */
export function moveCrossesWall(
  board: Board,
  soldier: SoldierObj,
  targetVertexId: VertexId
): { edgeId: EdgeId; wallOwnerName: string } | null {
  const target = board.vertices[targetVertexId];
  if (!target) return null;
  for (const edgeId of target.roadIds) {
    const edge = board.edges[edgeId];
    if (!edge || edge.roadId === null) continue;
    const other = edge.vertexAId === soldier.vertexId ? edge.vertexBId : edge.vertexAId;
    if (other !== targetVertexId) continue;
    const road = board.roads[edge.roadId];
    if (road?.isWall && road.ownerId !== soldier.owner) {
      return { edgeId, wallOwnerName: road.ownerId };
    }
  }
  return null;
}

/** Wall-upgrade check: Build phase, your turn, your plain road, 2 brick. */
export function canUpgradeRoadToWall(room: GameRoom, player: Player, edgeId: EdgeId): BuildCheck {
  if (!room.wallsEnabled) return fail('Walls are disabled in this game');
  const turn = room.turnState;
  if (turn.player !== player.name) return fail('Not your turn');
  if (turn.phase !== 'Build') return fail('Walls can only be built in the Build phase');
  const edge = room.board?.edges[edgeId];
  if (!edge) return fail('Edge not found');
  const road = edge.roadId ? room.board!.roads[edge.roadId] : undefined;
  if (!road) return fail('There is no road on that edge');
  if (road.ownerId !== player.name) return fail('You can only fortify your own roads');
  if (road.isWall) return fail('That road is already a wall');
  if (!canAfford(player.resources, WallPrice))
    return fail('Not enough resources for a wall (2 brick)');
  return pass;
}

export function applyUpgradeRoadToWall(room: GameRoom, player: Player, edgeId: EdgeId): void {
  const edge = room.board!.edges[edgeId];
  const road = room.board!.roads[edge.roadId!];
  player.resources = subtractPrice(player.resources, WallPrice);
  road.isWall = true;
  room.turnState.undoLog.push({ kind: 'upgradeRoadToWall', roadId: road.id });
}

/**
 * Guess check: the crosser owes a 1-6 guess on the pending wall gate.
 */
export function canWallGuess(room: GameRoom, player: Player, guess: number): BuildCheck {
  if (!room.wallsEnabled) return fail('Walls are disabled in this game');
  const gate = room.wallGate;
  if (!gate) return fail('No wall gate is pending');
  if (gate.crosserName !== player.name) return fail('You are not the one crossing');
  if (gate.guess !== null || gate.roll !== null) return fail('A guess is already in — the wall owner must roll');
  if (!Number.isInteger(guess) || guess < 1 || guess > 6)
    return fail('Guess must be a whole number from 1 to 6');
  return pass;
}

export function applyWallGuess(room: GameRoom, _player: Player, guess: number): void {
  room.wallGate!.guess = guess;
}

/**
 * Wall-owner roll check: once the guess is in, the wall owner resolves the
 * gate (the server supplies the d6 roll to `applyRollWallGate`).
 */
export function canRollWallGate(room: GameRoom, player: Player): BuildCheck {
  if (!room.wallsEnabled) return fail('Walls are disabled in this game');
  const gate = room.wallGate;
  if (!gate) return fail('No wall gate is pending');
  if (gate.wallOwnerName !== player.name) return fail('Only the wall owner rolls the gate');
  if (gate.roll !== null) return fail('The gate already resolved');
  return pass;
}

/**
 * Apply the resolving roll: a match moves the soldier onto the target vertex
 * (undoable crossing); a miss leaves it in place. The soldier's action is
 * consumed either way. The gate keeps the roll on record briefly (cleared
 * server-side after WALL_GATE_REVEAL_MS) so every client can show the
 * outcome before it disappears.
 */

/** How long a resolved gate lingers so every player sees the outcome. */
export const WALL_GATE_REVEAL_MS = 3000;

export function applyRollWallGate(
  room: GameRoom,
  _player: Player,
  roll: number
): { roll: number; crossed: boolean } {
  const board = room.board!;
  const gate = room.wallGate!;
  const soldier = board.soldiers[gate.soldierId];
  const crossed = gate.guess === roll;
  gate.roll = roll;
  if (!soldier) {
    room.wallGate = null;
    return { roll, crossed: false };
  }
  if (crossed) {
    room.turnState.undoLog.push({
      kind: 'wallGateCross',
      soldierId: soldier.id,
      originalVertexId: soldier.vertexId,
    });
    soldier.vertexId = gate.targetVertexId;
    soldier.stationed = false; // crossing out of a garrison clears the flag
  }
  room.turnState.soldiersActedThisTurn.push(gate.soldierId);
  return { roll, crossed };
}
