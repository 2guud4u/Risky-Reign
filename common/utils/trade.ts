import { GameRoom } from '../types/Room';
import { Price, ResourceCount, TradeOffer } from '../types/Logic';
import { Player } from '../types/Player';

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
