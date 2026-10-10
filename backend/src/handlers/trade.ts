import {
  normalizePrice,
  canCreateTradeOffer,
  canAcceptTradeOffer,
  canTakeTradeOffer,
  applyTrade,
  canBankTrade,
  applyBankTrade,
  applyBonuses,
  ResourceKey,
  RESOURCES,
} from 'common';
import { gameRooms, announceTrade, freshResourceCount } from '../store';
import { broadcastRoom } from '../broadcast';
import { HandlerContext, blockIfCannotAct } from './context';

/**
 * Trade handlers: creating/accepting/declining/cancelling player-to-player
 * trade offers, and trading with the bank.
 */
export function registerTradeHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // ---- Trade offers (draft anytime; accept only on your turn) ----

  socket.on(
    'createTradeOffer',
    (data: { roomId: string; to: string | null; give?: unknown; want?: unknown }) => {
      const { roomId, to } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfCannotAct(room, socket)) return;
      const sender = room.players.find((p) => p.id === socket.id);
      if (!sender) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }
      const give = normalizePrice(data.give);
      const want = normalizePrice(data.want);
      const check = canCreateTradeOffer(room, sender.name, to, give, want);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot create this trade offer' });
        return;
      }
      room.tradeOffers.push({
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        from: sender.name,
        to: to ?? null,
        give,
        want,
        claimer: null,
        status: 'pending',
      });
      applyBonuses(room);
      broadcastRoom(io, room);
    }
  );

  socket.on('acceptTrade', (data: { roomId: string; tradeId: string }) => {
    const { roomId, tradeId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const acceptor = room.players.find((p) => p.id === socket.id);
    if (!acceptor) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    const offer = room.tradeOffers.find((o) => o.id === tradeId);
    if (!offer) {
      socket.emit('error', { message: 'Trade offer not found' });
      return;
    }
    const check = canAcceptTradeOffer(room, offer, acceptor.name);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot accept this trade' });
      return;
    }
    applyTrade(room, offer);
    offer.status = 'accepted';
    // Directed offer: `to`; open offer: whoever took it.
    announceTrade(room, offer.from, offer.to ?? offer.claimer ?? null, offer.give, offer.want);
    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // Take an open offer (to === null): any player who isn't the creator may
  // claim it; the creator then accepts or declines the taker.
  socket.on('takeTrade', (data: { roomId: string; tradeId: string }) => {
    const { roomId, tradeId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    const offer = room.tradeOffers.find((o) => o.id === tradeId);
    if (!offer) {
      socket.emit('error', { message: 'Trade offer not found' });
      return;
    }
    const check = canTakeTradeOffer(room, offer, player.name);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot take this offer' });
      return;
    }
    offer.claimer = player.name;
    applyBonuses(room);
    broadcastRoom(io, room);
  });

  socket.on('declineTrade', (data: { roomId: string; tradeId: string }) => {
    const { roomId, tradeId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    const offer = room.tradeOffers.find((o) => o.id === tradeId);
    if (!offer || offer.status !== 'pending') return;
    if (offer.to === null) {
      // Open offer: the creator declines the taker (clears the claim, leaving
      // the offer open), or the taker retracts their claim.
      if (offer.claimer && offer.from === player.name) {
        offer.claimer = null;
      } else if (offer.claimer === player.name) {
        offer.claimer = null;
      } else {
        return;
      }
    } else if (offer.to === player.name) {
      // Directed offer: the recipient declines it.
      offer.status = 'declined';
    } else {
      return;
    }
    applyBonuses(room);
    broadcastRoom(io, room);
  });

  socket.on('cancelTrade', (data: { roomId: string; tradeId: string }) => {
    const { roomId, tradeId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    const offer = room.tradeOffers.find((o) => o.id === tradeId);
    // Only the creator may cancel, and only while pending.
    if (offer && offer.from === player.name && offer.status === 'pending') {
      offer.status = 'cancelled';
      applyBonuses(room);
      broadcastRoom(io, room);
    }
  });
  socket.on('bankTrade', (data: {
    roomId: string;
    giveResource: string;
    wantResource: string;
    giveCount: number;
  }) => {
    const { roomId, giveResource, wantResource, giveCount } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    // Validate the untyped payload before touching state: the resource names must
    // be real (else an invalid key writes NaN into resources while still draining
    // the bank) and the count must be a positive integer.
    if (
      !RESOURCES.includes(giveResource as ResourceKey) ||
      !RESOURCES.includes(wantResource as ResourceKey)
    ) {
      socket.emit('error', { message: 'Invalid resource' });
      return;
    }
    if (!Number.isInteger(giveCount) || giveCount <= 0) {
      socket.emit('error', { message: 'Give count must be a positive integer' });
      return;
    }
    const check = canBankTrade(
      room,
      player.name,
      giveResource as ResourceKey,
      wantResource as ResourceKey,
      giveCount,
      room.bankSupply
    );
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Bank trade not allowed' });
      return;
    }
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
    applyBonuses(room);
    broadcastRoom(io, room);
  });
}
