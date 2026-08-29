import { Board, HexId } from '../types/Board';
import { Player } from '../types/Player';
import { ResourceKey } from '../types/Logic';
import { BuildCheck } from './validation';

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

/**
 * Names of players (optionally excluding one) with a settlement or a road on
 * a vertex of the given hex.
 */
export function playersAdjacentToHex(board: Board, hexId: HexId, excludeName?: string): string[] {
  const names = new Set<string>();
  for (const vertex of Object.values(board.vertices)) {
    if (!vertex.hexIds.includes(hexId)) continue;
    if (vertex.settlementId) {
      const settlement = board.settlements[vertex.settlementId];
      if (settlement && settlement.ownerId !== excludeName) names.add(settlement.ownerId);
    }
    for (const roadId of vertex.roadIds) {
      const road = board.roads[roadId];
      if (road && road.ownerId !== excludeName) names.add(road.ownerId);
    }
  }
  return Array.from(names);
}

/**
 * Steal one random resource card from a random player in `players` (chosen
 * among `victimNames`) and give it to `thief`. Returns the stolen resource
 * type, or null when no eligible victim holds any cards.
 */
export function stealRandomCard(thief: Player, players: Player[], victimNames: string[]): ResourceKey | null {
  const victims = players.filter((p) => victimNames.includes(p.name));
  const withCards = victims.filter((p) => Object.values(p.resources).some((n) => n > 0));
  if (withCards.length === 0) return null;
  const victim = withCards[Math.floor(Math.random() * withCards.length)];
  const held = (Object.entries(victim.resources) as [ResourceKey, number][]).filter(([, n]) => n > 0);
  const [resource] = held[Math.floor(Math.random() * held.length)];
  victim.resources[resource] -= 1;
  thief.resources[resource] += 1;
  return resource;
}
