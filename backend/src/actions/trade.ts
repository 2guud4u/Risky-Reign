/**
 * Trade actions: creating/accepting/declining/cancelling player-to-player
 * trade offers, and trading with the bank.
 */
import {
  normalizePrice,
  canCreateTradeOffer,
  canAcceptTradeOffer,
  canTakeTradeOffer,
  applyTrade,
  canBankTrade,
  applyBankTrade,
  GameRoom,
  Player,
  Price,
  ResourceKey,
  RESOURCES,
} from 'common';
import { announceTrade, freshResourceCount } from '../store';
import type { ActionEntry } from '../dispatch';

const fail = (error: string) => ({ error });
const silent = { broadcast: false as const };

export const TRADE_ACTIONS: Record<string, ActionEntry> = {
  createTradeOffer: {
    run: (
      room: GameRoom,
      player: Player,
      { to, give, want }: { roomId: string; to: string | null; give: Price; want: Price }
    ) => {
      const g = normalizePrice(give);
      const w = normalizePrice(want);
      const check = canCreateTradeOffer(room, player.name, to, g, w);
      if (!check.allowed) return fail(check.reason ?? 'Cannot create this trade offer');
      room.tradeOffers.push({
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        from: player.name,
        to: to ?? null,
        give: g,
        want: w,
        claimer: null,
        status: 'pending',
      });
    },
  },

  acceptTrade: {
    run: (room: GameRoom, player: Player, { tradeId }: { roomId: string; tradeId: string }) => {
      const offer = room.tradeOffers.find((o) => o.id === tradeId);
      if (!offer) return fail('Trade offer not found');
      const check = canAcceptTradeOffer(room, offer, player.name);
      if (!check.allowed) return fail(check.reason ?? 'Cannot accept this trade');
      applyTrade(room, offer);
      offer.status = 'accepted';
      // Directed offer: `to`; open offer: whoever took it.
      announceTrade(room, offer.from, offer.to ?? offer.claimer ?? null, offer.give, offer.want);
    },
  },

  // Take an open offer (to === null): any player who isn't the creator may
  // claim it; the creator then accepts or declines the taker.
  takeTrade: {
    run: (room: GameRoom, player: Player, { tradeId }: { roomId: string; tradeId: string }) => {
      const offer = room.tradeOffers.find((o) => o.id === tradeId);
      if (!offer) return fail('Trade offer not found');
      const check = canTakeTradeOffer(room, offer, player.name);
      if (!check.allowed) return fail(check.reason ?? 'Cannot take this offer');
      offer.claimer = player.name;
    },
  },

  declineTrade: {
    run: (room: GameRoom, player: Player, { tradeId }: { roomId: string; tradeId: string }) => {
      const offer = room.tradeOffers.find((o) => o.id === tradeId);
      if (!offer || offer.status !== 'pending') return silent;
      if (offer.to === null) {
        // Open offer: the creator declines the taker (clears the claim, leaving
        // the offer open), or the taker retracts their claim.
        if (offer.claimer && offer.from === player.name) {
          offer.claimer = null;
        } else if (offer.claimer === player.name) {
          offer.claimer = null;
        } else {
          return silent;
        }
      } else if (offer.to === player.name) {
        // Directed offer: the recipient declines it.
        offer.status = 'declined';
      } else {
        return silent;
      }
    },
  },

  cancelTrade: {
    run: (room: GameRoom, player: Player, { tradeId }: { roomId: string; tradeId: string }) => {
      const offer = room.tradeOffers.find((o) => o.id === tradeId);
      // Only the creator may cancel, and only while pending.
      if (offer && offer.from === player.name && offer.status === 'pending') {
        offer.status = 'cancelled';
        return;
      }
      return silent;
    },
  },

  bankTrade: {
    run: (
      room: GameRoom,
      player: Player,
      {
        giveResource,
        wantResource,
        giveCount,
      }: { roomId: string; giveResource: string; wantResource: string; giveCount: number }
    ) => {
      // Validate the untyped payload before touching state: the resource names must
      // be real (else an invalid key writes NaN into resources while still draining
      // the bank) and the count must be a positive integer.
      if (
        !RESOURCES.includes(giveResource as ResourceKey) ||
        !RESOURCES.includes(wantResource as ResourceKey)
      ) {
        return fail('Invalid resource');
      }
      if (!Number.isInteger(giveCount) || giveCount <= 0) {
        return fail('Give count must be a positive integer');
      }
      const check = canBankTrade(
        room,
        player.name,
        giveResource as ResourceKey,
        wantResource as ResourceKey,
        giveCount,
        room.bankSupply
      );
      if (!check.allowed) return fail(check.reason ?? 'Bank trade not allowed');
      const got = applyBankTrade(
        room,
        player.name,
        giveResource as ResourceKey,
        wantResource as ResourceKey,
        giveCount,
        room.bankSupply
      );
      announceTrade(
        room,
        player.name,
        null,
        { ...freshResourceCount(0), [giveResource]: giveCount },
        { ...freshResourceCount(0), [wantResource]: got }
      );
    },
  },
};
