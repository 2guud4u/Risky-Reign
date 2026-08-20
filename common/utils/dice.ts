import { Board } from '../types/Board';
import { Player } from '../types/Player';
import { Resource, Terrain } from '../types/Hex';
import { TerrainResourceMap } from './hex';

/** Sum of the two dice (both must be rolled). */
export function rollTotal(die1: number, die2: number): number {
  return die1 + die2;
}

/** A single resource grant produced by a dice payout. */
export interface Payout {
  playerName: string;
  resource: Exclude<Resource, 'Nothing'>;
  amount: number;
}

/**
 * Compute the resource payouts for a roll total: every settlement/city on a
 * hex whose token matches the total earns that terrain's resource
 * (settlement = 1, city = 2). Water and Desert produce nothing.
 */
export function computePayouts(board: Board, total: number): Payout[] {
  const payouts: Payout[] = [];
  for (const hex of Object.values(board.hexes)) {
    if (hex.rollNumber !== total) continue;
    const resource = TerrainResourceMap[hex.terrain as Terrain];
    if (!resource || resource === 'Nothing') continue;
    for (const v of Object.values(board.vertices)) {
      if (v.settlementId === null || !v.hexIds.includes(hex.id)) continue;
      const settlement = board.settlements[v.settlementId];
      if (!settlement) continue;
      payouts.push({
        playerName: settlement.ownerId,
        resource,
        amount: settlement.level === 'city' ? 2 : 1,
      });
    }
  }
  return payouts;
}

/** Apply a list of payouts to the players' resource counts (mutates players). */
export function applyPayouts(players: Player[], payouts: Payout[]): void {
  for (const payout of payouts) {
    const player = players.find((p) => p.name === payout.playerName);
    if (player) player.resources[payout.resource] += payout.amount;
  }
}
