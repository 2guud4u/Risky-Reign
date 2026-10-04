import {
  applyBonuses,
  rollTotal,
  computePayouts,
  applyPayouts,
  RESOURCES,
} from 'common';
import { advanceTurn } from '../../turn';
import { gameRooms } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, blockIfCannotAct } from '../context';

/**
 * Dice-roll handler: rolling the dice one die per click during the Dice
 * phase, with 7-robber setup (pending discards) and payout resolution.
 */
export function registerDiceHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  socket.on('rollDice', (data: { roomId: string }) => {
    const { roomId } = data;
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
    // Only the dice player may roll, and only during the Dice phase.
    if (room.turnState.phase !== 'Dice') {
      socket.emit('error', { message: 'It is not the Dice phase' });
      return;
    }
    const dicePlayer = room.turnState.player;
    const socketPlayer = room.players.find((p) => p.id === socket.id);
    if (!socketPlayer || socketPlayer.name !== dicePlayer) {
      socket.emit('error', { message: 'It is not your turn to roll' });
      return;
    }

    // A pending 7 (robber move or steal) must be resolved before any
    // further roll.
    if (room.robberMove?.reason === 'seven' || room.steal) {
      socket.emit('error', { message: 'Resolve the 7 before rolling again' });
      return;
    }

    // One die per click: the first click rolls die 1, the second rolls die 2.
    const roll = room.roll;
    const value = Math.floor(Math.random() * 6) + 1;
    if (roll.die1 === null) {
      room.roll = { die1: value, die2: null };
    } else if (roll.die2 === null) {
      room.roll = { die1: roll.die1, die2: value };
    } else {
      socket.emit('error', { message: 'Both dice are already rolled' });
      return;
    }

    // When both dice are in: a 7 holds the Dice phase until the robber is
    // moved (no payout — no hex carries a 7 token); any other total pays
    // out resources and advances to the Build phase automatically.
    if (room.roll.die1 !== null && room.roll.die2 !== null) {
      const total = rollTotal(room.roll.die1, room.roll.die2);
      if (total === 7) {
        room.robberMove = { player: dicePlayer, reason: 'seven' };
        // Standard 7: every player holding 8+ resource cards must discard
        // down to half (floor). Discards must be resolved before the
        // robber can be moved. Knocked-out players can't act, so they're
        // exempt (their discard would wedge the Dice phase).
        const discards: Record<string, number> = {};
        for (const p of room.players) {
          if (p.eliminated) continue;
          const hand = RESOURCES.reduce((sum, r) => sum + p.resources[r], 0);
          if (hand >= 8) discards[p.name] = Math.floor(hand / 2);
        }
        room.discards = discards;
      } else {
        const { payouts, robbed } = computePayouts(board, total);
        applyPayouts(room.players, payouts);
        for (const r of RESOURCES) room.robberBag[r] += robbed[r];
        advanceTurn(room);
      }
    }

    applyBonuses(room);
    broadcastRoom(io, room);
  });
}
