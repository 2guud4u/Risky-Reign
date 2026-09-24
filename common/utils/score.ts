import { Board } from '../types/Board';
import { GameRoom } from '../types/Room';
import { LONGEST_ROAD_MIN, LARGEST_ARMY_MIN, BONUS_VP } from '../Constant';

/**
 * Room scoring bonuses: Longest Road and Largest Army (standard Catan rules).
 *  - Longest Road: a single continuous chain of at least 5 roads earns 2 VP.
 *  - Largest Army: having at least 3 soldiers earns 2 VP (soldier count is
 *    simply how many soldiers a player has on the board).
 *
 * diffs the freshly computed state against `room.bonuses` and adjusts each
 * player's `victoryPoints` by the delta only. It then runs the win check
 * (`checkWinCondition`): the first player at `WIN_VP` (10) points ends the
 * game.
 */

/** Total number of soldiers a player currently has on the board. */
export function countSoldiers(board: Board, playerName: string): number {
  return Object.values(board.soldiers).filter((s) => s.owner === playerName).length;
}

/**
 * Victory points from a player's settlements (1 VP each) and cities (2 VP each).
 */
export function countSettlementVp(board: Board, playerName: string): number {
  let vp = 0;
  for (const s of Object.values(board.settlements)) {
    if (s.ownerId === playerName) {
      vp += s.level === 'city' ? 2 : 1;
    }
  }
  return vp;
}

/**
 * Longest continuous road chain for a player: the maximum number of roads
 * connected end-to-end (a road's endpoints are its two vertices). Returns 0
 * when the player has no roads.
 */
export function longestRoadLength(board: Board, playerName: string): number {
  // Build the adjacency list: vertexId -> neighbor vertices, via this player's roads.
  const adjacency = new Map<string, Set<string>>();
  for (const edge of Object.values(board.edges)) {
    if (edge.roadId === null) continue;
    const road = board.roads[edge.roadId];
    if (!road || road.ownerId !== playerName) continue;
    if (!adjacency.has(edge.vertexAId)) adjacency.set(edge.vertexAId, new Set());
    if (!adjacency.has(edge.vertexBId)) adjacency.set(edge.vertexBId, new Set());
    adjacency.get(edge.vertexAId)!.add(edge.vertexBId);
    adjacency.get(edge.vertexBId)!.add(edge.vertexAId);
  }

  // Longest path (counted in roads) starting from each vertex.
  let best = 0;
  for (const start of adjacency.keys()) {
    const visited = new Set<string>([start]);
    const stack: [string, number][] = [[start, 0]];
    while (stack.length > 0) {
      const [vertex, depth] = stack.pop()!;
      best = Math.max(best, depth);
      for (const next of adjacency.get(vertex) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push([next, depth + 1]);
        }
      }
    }
  }
  return best;
}

/**
 * Recompute the room's scoring bonuses from the board and apply them to each
 * player's victory points. Ties keep the bonus: every player tied with the
 * leader holds it (deterministic, no flapping between broadcasts).
 */
export function applyBonuses(room: GameRoom): void {
  const names = room.players.map((p) => p.name);
  const road: Record<string, number> = {};
  const army: Record<string, number> = {};
  const settlementVp: Record<string, number> = {};
  for (const name of names) {
    road[name] = room.board ? longestRoadLength(room.board, name) : 0;
    army[name] = room.board ? countSoldiers(room.board, name) : 0;
    settlementVp[name] = room.board ? countSettlementVp(room.board, name) : 0;
  }

  const maxRoad = names.length > 0 ? Math.max(...names.map((n) => road[n])) : 0;
  const maxArmy = names.length > 0 ? Math.max(...names.map((n) => army[n])) : 0;
  const prev = room.bonuses;

  const hasLongestRoad: Record<string, boolean> = {};
  const hasLargestArmy: Record<string, boolean> = {};
  for (const name of names) {
    hasLongestRoad[name] = maxRoad >= LONGEST_ROAD_MIN && road[name] === maxRoad;
    hasLargestArmy[name] = maxArmy >= LARGEST_ARMY_MIN && army[name] === maxArmy;
  }

  for (const p of room.players) {
    const wasRoad = prev?.hasLongestRoad?.[p.name] ?? false;
    const wasArmy = prev?.hasLargestArmy?.[p.name] ?? false;
    const isRoad = hasLongestRoad[p.name] ?? false;
    const isArmy = hasLargestArmy[p.name] ?? false;
    const wasSettlement = prev?.settlementVp?.[p.name] ?? 0;
    const isSettlement = settlementVp[p.name] ?? 0;
    p.victoryPoints +=
      (isRoad ? BONUS_VP : 0) -
      (wasRoad ? BONUS_VP : 0) +
      (isArmy ? BONUS_VP : 0) -
      (wasArmy ? BONUS_VP : 0) +
      (isSettlement - wasSettlement);
  }

  room.bonuses = { longestRoad: road, largestArmy: army, hasLongestRoad, hasLargestArmy, settlementVp };
  checkWinCondition(room);
}

/**
 * Win condition: the first player to reach the room's `pointsToWin`
 * threshold (default 10, the standard Catan value) wins. The check prefers
 * the acting player — a player wins on their own turn — and falls back to
 * the first player in turn order with enough points (deterministic).
 * Idempotent: once `gameStatus` is 'finished' the room is never changed
 * again, so it is safe to run on every broadcast.
 */
export function checkWinCondition(room: GameRoom): void {
  if (room.gameStatus !== 'playing') return;
  const threshold = room.pointsToWin;
  const acting = room.players.find((p) => p.name === room.turnState.player);
  const winner =
    (acting && acting.victoryPoints >= threshold ? acting : null) ??
    room.players.find((p) => p.victoryPoints >= threshold);
  if (winner) {
    room.gameStatus = 'finished';
    room.winner = winner.name;
  }
}
