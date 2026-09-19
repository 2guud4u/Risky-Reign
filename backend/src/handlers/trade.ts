import {
  normalizePrice,
  canCreateTradeOffer,
  canAcceptTradeOffer,
  applyTrade,
  canBankTrade,
  applyBankTrade,
  applyBonuses,
  ResourceKey,
} from 'common';
import { gameRooms } from '../store';
import { HandlerContext, blockIfFinished } from './context';

/**
 * Trade handlers: creating/accepting/declining/cancelling player-to-player
 * trade offers, and trading with the bank.
 */
export function registerTradeHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // ---- Trade offers (draft anytime; accept only on your turn) ----

  socket.on(
    'createTradeOffer',
    (data: { roomId: string; to: string; give?: unknown; want?: unknown }) => {
      const { roomId, to } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfFinished(room, socket)) return;
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
        to,
        give,
        want,
        status: 'pending',
      });
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );

  socket.on('acceptTrade', (data: { roomId: string; tradeId: string }) => {
    const { roomId, tradeId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
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
    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  socket.on('declineTrade', (data: { roomId: string; tradeId: string }) => {
    const { roomId, tradeId } = data;
    const room = gameRooms.get(roomId);
    if (!room) return;
    if (blockIfFinished(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    const offer = room.tradeOffers.find((o) => o.id === tradeId);
    // Only the recipient may decline, and only while pending.
    if (offer && offer.to === player.name && offer.status === 'pending') {
      offer.status = 'declined';
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  });

  socket.on('cancelTrade', (data: { roomId: string; tradeId: string }) => {
    const { roomId, tradeId } = data;
    const room = gameRooms.get(roomId);
    if (!room) return;
    if (blockIfFinished(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    const offer = room.tradeOffers.find((o) => o.id === tradeId);
    // Only the creator may cancel, and only while pending.
    if (offer && offer.from === player.name && offer.status === 'pending') {
      offer.status = 'cancelled';
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
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
    if (!room) return;
    if (blockIfFinished(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
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
    applyBankTrade(
      room,
      player.name,
      giveResource as ResourceKey,
      wantResource as ResourceKey,
      giveCount,
      room.bankSupply
    );
    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });
}
