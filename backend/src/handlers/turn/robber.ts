import {
  applyBonuses,
  canPlaceRobberOn,
  placeRobber,
  playersAdjacentToHex,
  eligibleVictims,
  stealCard,
  RESOURCES,
} from 'common';
import { advanceTurn } from '../../turn';
import { gameRooms } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, blockIfCannotAct } from '../context';

/**
 * Robber-resolution handlers: placing the robber (after a 7 or a knight),
 * resolving the pending steal, and resolving pending 7-discards.
 */
export function registerRobberHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // Place the robber. Mandatory after a 7 roll and after a played knight
  // card. After a 7, the thief chooses which card to steal from a face-down
  // card of an adjacent player (the `chooseSteal` event) and the Dice phase
  // holds until the steal resolves. A knight only moves the robber — no steal.
  socket.on('moveRobber', (data: { roomId: string; hexId: string }) => {
    const { roomId, hexId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    // Only the player with a pending robber move may place it.
    if (!room.robberMove || room.robberMove.player !== player.name) {
      socket.emit('error', { message: 'You have no pending robber move' });
      return;
    }
    // A 7 requires every discard to be resolved before the robber moves.
    if (room.robberMove.reason === 'seven' && Object.keys(room.discards).length > 0) {
      socket.emit('error', { message: 'Resolve the 7 discards before moving the robber' });
      return;
    }
    const check = canPlaceRobberOn(board, hexId);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot place the robber there' });
      return;
    }

    const reason = room.robberMove.reason;
    placeRobber(board, hexId);
    room.robberMove = null;

    if (reason === 'knight') {
      // A knight only moves the robber: consume the card, no steal.
      const cardIndex = player.developmentCards.indexOf('knight');
      if (cardIndex !== -1) player.developmentCards.splice(cardIndex, 1);
    } else {
      // A 7: steal from an eligible victim (adjacent to the hex, ≥ 1 card)
      // before the Dice phase completes; with none, it completes now.
      const adjacent = playersAdjacentToHex(board, hexId, player.name);
      const victims = eligibleVictims(room.players, adjacent);
      if (victims.length > 0) room.steal = { thief: player.name, victims };
      else advanceTurn(room);
    }

    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // Resolve a pending 7-steal: the thief takes the face-down card at
  // `cardIndex` from `victimName`, which completes the Dice phase.
  socket.on('chooseSteal', (data: { roomId: string; victimName: string; cardIndex: number }) => {
    const { roomId, victimName, cardIndex } = data;
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
    if (!room.steal || room.steal.thief !== player.name) {
      socket.emit('error', { message: 'You have no pending steal' });
      return;
    }
    if (!room.steal.victims.includes(victimName)) {
      socket.emit('error', { message: 'That player is not a valid steal target' });
      return;
    }
    const victim = room.players.find((p) => p.name === victimName);
    if (!victim) {
      socket.emit('error', { message: 'Steal target not found' });
      return;
    }
    if (!Number.isInteger(cardIndex)) {
      socket.emit('error', { message: 'Invalid card selection' });
      return;
    }
    const stolen = stealCard(player, victim, cardIndex);
    if (!stolen) {
      socket.emit('error', { message: 'Invalid card selection' });
      return;
    }
    room.steal = null;
    advanceTurn(room);

    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // Resolve a pending 7-discard: the player hands in exactly `required`
  // resource cards (the floor of half their hand), choosing which ones.
  socket.on('resolveDiscard', (data: { roomId: string; discards: Record<string, number> }) => {
    const { roomId, discards } = data;
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
    const storedRequired = room.discards[player.name];
    if (storedRequired === undefined) {
      socket.emit('error', { message: 'You have no pending discard' });
      return;
    }
    // If the player traded cards away after the 7, the original requirement
    // could exceed half their current hand; cap it so a legal resolution
    // stays possible (otherwise the Dice phase could wedge forever).
    const handTotal = RESOURCES.reduce((sum, r) => sum + player.resources[r], 0);
    const required = Math.min(storedRequired, Math.floor(handTotal / 2));
    let total = 0;
    for (const r of RESOURCES) {
      const n = Math.floor(discards[r] ?? 0);
      if (n < 0 || n > player.resources[r]) {
        socket.emit('error', { message: 'Invalid discard selection' });
        return;
      }
      total += n;
    }
    if (total !== required) {
      socket.emit('error', { message: `Discard exactly ${required} cards` });
      return;
    }
    for (const r of RESOURCES) {
      const n = Math.floor(discards[r] ?? 0);
      player.resources[r] -= n;
      room.robberBag[r] += n;
    }
    delete room.discards[player.name];
    applyBonuses(room);
    broadcastRoom(io, room);
  });
}
