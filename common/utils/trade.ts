import { GameRoom } from '../types/Room';
import { Price, ResourceCount, ResourceKey, TradeOffer } from '../types/Logic';
import { Player } from '../types/Player';
import { Board, VertexNode } from '../types/Board';

/** Result of a trade-eligibility check. */
export interface TradeCheck {
  allowed: boolean;
  reason: string | null;
}

const RESOURCES = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'] as const;

/** Normalize an unknown input into a valid Price (clamped to >= 0). */
export function normalizePrice(input: unknown): Price {
  const price: Price = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };
  if (!input || typeof input !== 'object') return price;
  for (const key of RESOURCES) {
    const value = (input as Record<string, unknown>)[key];
    price[key] = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }
  return price;
}

/** Whether a price asks for at least one resource. */
export function hasAnyResource(price: Price): boolean {
  return RESOURCES.some((k) => price[k] > 0);
}

/** Whether a player's resources can cover the given price. */
export function covers(resources: ResourceCount, price: Price): boolean {
  return RESOURCES.every((k) => resources[k] >= price[k]);
}

/** Subtract `price` from `resources`, returning a new object. */
export function subtractPrice(resources: Price, price: Price): Price {
  const out = { ...resources };
  for (const k of RESOURCES) out[k] -= price[k];
  return out;
}

/** Add `price` to `resources`, returning a new object. */
export function addPrice(resources: Price, price: Price): Price {
  const out = { ...resources };
  for (const k of RESOURCES) out[k] += price[k];
  return out;
}

/**
 * Check whether a trade offer may be created.
 * Any player in the room may draft an offer at any time.
 */
export function canCreateTradeOffer(
  room: GameRoom,
  fromName: string,
  toName: string,
  give: Price,
  want: Price
): TradeCheck {
  const from = room.players.find((p) => p.name === fromName);
  if (!from) return { allowed: false, reason: 'You are not in this room' };
  if (fromName === toName) return { allowed: false, reason: 'Cannot trade with yourself' };
  const to = room.players.find((p) => p.name === toName);
  if (!to) return { allowed: false, reason: 'Recipient not found in this room' };
  if (!hasAnyResource(give)) return { allowed: false, reason: 'Offer at least one resource' };
  if (!covers(from.resources, give)) return { allowed: false, reason: 'You cannot afford that offer' };
  return { allowed: true, reason: null };
}

/**
 * Check whether a trade offer may be accepted.
 * Only the recipient may accept, and only while EITHER player in the trade
 * is in their Trade phase.
 */
export function canAcceptTradeOffer(room: GameRoom, offer: TradeOffer, playerName: string): TradeCheck {
  if (offer.to !== playerName) return { allowed: false, reason: 'Only the recipient can accept this trade' };
  if (offer.status !== 'pending') return { allowed: false, reason: 'This trade is no longer pending' };
  const inTradePhase = room.turnState.phase === 'Trade';
  const eitherPlayerTrading =
    room.turnState.player === offer.from || room.turnState.player === offer.to;
  if (!inTradePhase || !eitherPlayerTrading)
    return { allowed: false, reason: 'You can only accept trades while either player is in their Trade phase' };
  const from = room.players.find((p) => p.name === offer.from);
  const to = room.players.find((p) => p.name === offer.to);
  if (!from || !to) return { allowed: false, reason: 'A trade participant is missing' };
  if (!covers(from.resources, offer.give))
    return { allowed: false, reason: `${offer.from} can no longer afford their part of the trade` };
  if (!covers(to.resources, offer.want))
    return { allowed: false, reason: 'You cannot afford your part of the trade' };
  return { allowed: true, reason: null };
}

/**
 * Apply an accepted trade: transfer resources both ways. Mutates players in place.
 */
export function applyTrade(room: GameRoom, offer: TradeOffer): void {
  const from = room.players.find((p) => p.name === offer.from);
  const to = room.players.find((p) => p.name === offer.to);
  if (!from || !to) return;
  from.resources = addPrice(subtractPrice(from.resources, offer.give), offer.want);
  to.resources = addPrice(subtractPrice(to.resources, offer.want), offer.give);
}

/** Find a player by name (helper for handlers). */
export function findPlayer(room: GameRoom, name: string): Player | undefined {
  return room.players.find((p) => p.name === name);
}

/**
 * Determine the best bank trade ratio for a player based on their
 * settlements/cities on trade ports (harbors).
 * - 2:1 if the player has a settlement/city on a special port of `giveResource`
 * - 3:1 if the player has a settlement/city on any generic port
 * - 4:1 otherwise
 */
export function bestBankTradeRatio(
  board: Board,
  player: Player,
  giveResource: ResourceKey
): number {
  // Check for a special port of the given resource (2:1).
  for (const v of Object.values(board.vertices)) {
    if (v.port === giveResource && hasSettlementOnVertex(board, v, player)) {
      return 2;
    }
  }
  // Check for a generic port (3:1).
  for (const v of Object.values(board.vertices)) {
    if (v.port === 'generic' && hasSettlementOnVertex(board, v, player)) {
      return 3;
    }
  }
  // Default bank trade (4:1).
  return 4;
}

/** Whether the player has a settlement or city on the given vertex. */
function hasSettlementOnVertex(board: Board, v: VertexNode, player: Player): boolean {
  if (!v.settlementId) return false;
  const settlement = board.settlements[v.settlementId];
  return settlement?.ownerId === player.id;
}

/**
 * @param room - the game room
 * @param playerName - the player attempting the trade
 * @param giveResource - the resource to give (per unit)
 * @param wantResource - the resource to receive
 * @param giveCount - how many units of `giveResource` to give
 * @param supply - the global supply of resources (optional; if omitted, no supply check)
 */
export function canBankTrade(
  room: GameRoom,
  playerName: string,
  giveResource: ResourceKey,
  wantResource: ResourceKey,
  giveCount: number,
  supply?: Record<ResourceKey, number>
): TradeCheck {
  if (giveResource === wantResource) {
    return { allowed: false, reason: 'Cannot trade a resource for itself' };
  }
  if (giveCount < 1) {
    return { allowed: false, reason: 'Must trade at least one resource' };
  }
  const player = findPlayer(room, playerName);
  if (!player) return { allowed: false, reason: 'Unknown player' };
  if (!room.board) return { allowed: false, reason: 'No board' };
  const ratio = bestBankTradeRatio(room.board, player, giveResource);
  const wantCount = Math.floor(giveCount / ratio);
  if (wantCount < 1) {
    return { allowed: false, reason: `Need at least ${ratio} ${giveResource} for a 1:1 trade at ${ratio}:1` };
  }
  if (player.resources[giveResource] < giveCount) {
    return { allowed: false, reason: `Not enough ${giveResource} (have ${player.resources[giveResource]}, need ${giveCount})` };
  }
  if (supply && supply[wantResource] < wantCount) {
    return { allowed: false, reason: `Not enough ${wantResource} in supply (have ${supply[wantResource]}, need ${wantCount})` };
  }
  return { allowed: true, reason: null };
}

/**
 * Apply a bank trade: subtract `giveCount` of `giveResource`, add `wantCount` of `wantResource`.
 * Mutates the player in place. Returns the number of `wantResource` received.
 */
export function applyBankTrade(
  room: GameRoom,
  playerName: string,
  giveResource: ResourceKey,
  wantResource: ResourceKey,
  giveCount: number,
  supply?: Record<ResourceKey, number>
): number {
  const player = findPlayer(room, playerName)!;
  const ratio = bestBankTradeRatio(room.board!, player, giveResource);
  const wantCount = Math.floor(giveCount / ratio);
  player.resources[giveResource] -= giveCount;
  player.resources[wantResource] += wantCount;
  if (supply) {
    supply[wantResource] -= wantCount;
  }
  return wantCount;
}
