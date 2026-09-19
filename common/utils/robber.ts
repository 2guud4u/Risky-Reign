import { Board, HexId, HexNode } from '../types/Board';
import { CubeCoord } from '../types/Coordinates';
import { Player } from '../types/Player';
import { ResourceKey, BuildCheck } from '../types/Logic';
import { RESOURCES } from '../Constant';

/**
 * Authoritative robber-placement checks, shared by the UI (highlighting) and
 * the backend (the `moveRobber` handler).
 */

/**
 * Whether a hex is a valid robber target: it must exist, not be the desert
 * (the robber cannot sit on it), and not be the hex the robber already
 * occupies (placing it in place is a no-op).
 */
export function canPlaceRobberOn(board: Board, hexId: HexId): BuildCheck {
  const hex = board.hexes[hexId];
  if (!hex) return { allowed: false, reason: 'Unknown hex' };
  if (hex.terrain === 'Desert') return { allowed: false, reason: 'The robber cannot be placed on the desert' };
  if (hex.robber) return { allowed: false, reason: 'The robber is already on this hex' };
  return { allowed: true, reason: null };
}

/** Move the robber onto the given hex (caller validates first). */
export function placeRobber(board: Board, hexId: HexId): void {
  for (const h of Object.values(board.hexes)) h.robber = false;
  board.hexes[hexId].robber = true;
}

/** The six cube-coordinate unit directions (hex adjacency). */
const HEX_DIRECTIONS: CubeCoord[] = [
  { q: 1, r: -1, s: 0 },
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
];

/** Whether two hex coordinates are adjacent (cube distance 1). */
export function areHexesAdjacent(a: CubeCoord, b: CubeCoord): boolean {
  return HEX_DIRECTIONS.some(
    (d) => b.q - a.q === d.q && b.r - a.r === d.r && b.s - a.s === d.s
  );
}

/**
 * Ids of the hexes adjacent to the given hex (cube-coordinate distance 1).
 */
export function adjacentHexIds(board: Board, hexId: HexId): HexId[] {
  const hex = board.hexes[hexId];
  if (!hex) return [];
  return (Object.values(board.hexes) as HexNode[])
    .filter((h) => h.id !== hexId && areHexesAdjacent(hex.coord, h.coord))
    .map((h) => h.id);
}

/**
 * Authoritative check for moving the robber to an adjacent hex after a
 * victorious fight (Rules.md: "after the robber is defeated, the winner
 * can move the robber to any adjacent hex"). The target must exist, be
 * adjacent to the robber's current hex, and not be the desert.
 */
export function canMoveRobberAdjacent(
  board: Board,
  fromHexId: HexId,
  toHexId: HexId
): BuildCheck {
  if (toHexId === fromHexId)
    return { allowed: false, reason: 'The robber is already on this hex' };
  const target = board.hexes[toHexId];
  if (!target) return { allowed: false, reason: 'Unknown hex' };
  if (target.terrain === 'Desert')
    return { allowed: false, reason: 'The robber cannot be placed on the desert' };
  if (!adjacentHexIds(board, fromHexId).includes(toHexId))
    return { allowed: false, reason: 'That hex is not adjacent to the robber' };
  return { allowed: true, reason: null };
}

/**
 * Names of players (optionally excluding one) with a settlement or a city on
 * a vertex of the given hex. Roads do not count for steal eligibility
 * (standard Catan rule).
 */
export function playersAdjacentToHex(board: Board, hexId: HexId, excludeName?: string): string[] {
  const names = new Set<string>();
  for (const vertex of Object.values(board.vertices)) {
    if (!vertex.hexIds.includes(hexId)) continue;
    if (vertex.settlementId) {
      const settlement = board.settlements[vertex.settlementId];
      if (settlement && settlement.ownerId !== excludeName) names.add(settlement.ownerId);
    }
  }
  return Array.from(names);
}

/**
 * Expand a resource count into the individual cards it represents, in
 * `RESOURCES` (e.g. { Wood: 2, Brick: 1 } -> [Wood, Wood, Brick]).
 */
export function expandCards(resources: Record<ResourceKey, number>): ResourceKey[] {
  const cards: ResourceKey[] = [];
  for (const resource of RESOURCES) {
    const count = resources[resource] ?? 0;
    for (let i = 0; i < count; i++) cards.push(resource);
  }
  return cards;
}

/**
 * Names among `victimNames` that hold at least one resource card (the
 * eligible steal victims).
 */
export function eligibleVictims(players: Player[], victimNames: string[]): string[] {
  return players
    .filter((p) => victimNames.includes(p.name) && Object.values(p.resources).some((n) => n > 0))
    .map((p) => p.name);
}

/**
 * Take the card at `cardIndex` (see `expandCards`) from `victim` and give it
 * to `thief`. Returns the stolen resource type, or null when the index is out
 * of range.
 */
export function stealCard(thief: Player, victim: Player, cardIndex: number): ResourceKey | null {
  const cards = expandCards(victim.resources);
  if (cardIndex < 0 || cardIndex >= cards.length) return null;
  const resource = cards[cardIndex];
  victim.resources[resource] -= 1;
  thief.resources[resource] += 1;
  return resource;
}
