import { Board } from '../types/Board';
import { GameRoom } from '../types/Room';

/**
 * Room scoring bonuses: Longest Road and Largest Army (standard Catan rules).
 *  - Longest Road: a single continuous chain of at least 5 roads earns 2 VP.
 *  - Largest Army: having at least 3 soldiers earns 2 VP (soldier count is
 *    simply how many soldiers a player has on the board).
 *
 * `applyBonuses` is idempotent — it is safe to call on every broadcast: it
 * diffs the freshly computed state against `room.bonuses` and adjusts each
 * player's `victoryPoints` by the delta only.
 */

/** Minimum road count for the Longest Road bonus. */
export const LONGEST_ROAD_MIN = 5;
/** Minimum soldier count for the Largest Army bonus. */
export const LARGEST_ARMY_MIN = 3;
/** Victory points awarded by each bonus. */
export const BONUS_VP = 2;

/** Total number of soldiers a player currently has on the board. */
export function countSoldiers(board: Board, playerName: string): number {
  return Object.values(board.soldiers).filter((s) => s.owner === playerName).length;
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
  for (const name of names) {
    road[name] = room.board ? longestRoadLength(room.board, name) : 0;
    army[name] = room.board ? countSoldiers(room.board, name) : 0;
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
    p.victoryPoints +=
      (isRoad ? BONUS_VP : 0) -
      (wasRoad ? BONUS_VP : 0) +
      (isArmy ? BONUS_VP : 0) -
      (wasArmy ? BONUS_VP : 0);
  }

  room.bonuses = { longestRoad: road, largestArmy: army, hasLongestRoad, hasLargestArmy };
}
