/**
 * Command dispatch — the seam between transport and game rules.
 *
 * Every gameplay event a client can send maps to one entry in `ACTIONS`:
 * a socket-free function `(room, player, payload) → { error?, effects? }`
 * that checks the rule and mutates the room (mutate-then-report; the room
 * is the in-memory source of truth, not an immutable value).
 *
 * The socket adapter below owns the prelude every handler used to repeat
 * (room lookup → cannot-act gate → player resolution), runs the action,
 * emits the error or performs the returned effects, then applies bonuses
 * and broadcasts the sanitized room. Rules never see `io` or `socket` —
 * that's what makes every action headless-testable: the second adapter is
 * a test calling the same function.
 *
 * Room-lifecycle events (join, pause/resume, spectate, quickPlay, claimSeat)
 * are NOT dispatched: they create/delete rooms and resolve sockets, which
 * is transport work — they stay in `handlers/room/`.
 */
import { applyBonuses, GameEffect, GameRoom, Player } from 'common';
import { broadcastRoom } from './broadcast';
import { getRoom } from './store';
import { GameSocket, HandlerContext } from './handlers/context';

import { BUILD_ACTIONS } from './actions/build';
import { DEVCARD_ACTIONS } from './actions/devCards';
import { SOLDIER_ACTIONS } from './actions/soldier';
import { TRADE_ACTIONS } from './actions/trade';
import { TURN_ACTIONS } from './actions/turn';
import { BATTLE_ACTIONS } from './actions/battle';
import { ROOM_ACTIONS } from './actions/room';
import { broadcastPausedInfo } from './handlers/room/shared';
/** What an action returns. `{ error }` short-circuits; effects run on success. */
export interface ActionResult {
  error?: string;
  effects?: GameEffect[];
  /** 'gameUpdate' (default) for in-game actions, 'roomUpdate' for waiting-
   * lobby state, false for silent no-ops that shouldn't rebroadcast. */
  broadcast?: 'gameUpdate' | 'roomUpdate' | false;
}

/**
 * A gameplay action. `player` is the caller's seat — guaranteed non-null
 * unless the entry declares `seated: false`, in which case use
 * `OpenAction` (`player` may be a spectator/unknown socket).
 * `socketId` is always the caller's socket id — for host checks
 * (`room.players[0]?.id === socketId`) and spectator membership.
 */
export type Action<P = any> = (
  room: GameRoom,
  player: Player,
  payload: P,
  socketId: string
) => ActionResult | void;

export type OpenAction<P = any> = (
  room: GameRoom,
  player: Player | undefined,
  payload: P,
  socketId: string
) => ActionResult | void;

export interface ActionEntry {
  /** Seated action (default): the caller must hold a seat; `player` is non-null. */
  run?: Action;
  /** Open action: the caller may be a spectator or unknown socket. */
  open?: OpenAction;
  /** Skip the cannot-act gate (finished game / knocked-out seat). resetGame
   *  needs it — "Play Again" runs on a finished room; sendChat too (chat
   *  still works after the game ends). */
  allowFinished?: boolean;
}

type ActionTable = Partial<Record<string, ActionEntry>>;

const ACTIONS: ActionTable = {
  ...BUILD_ACTIONS,
  ...DEVCARD_ACTIONS,
  ...SOLDIER_ACTIONS,
  ...TRADE_ACTIONS,
  ...TURN_ACTIONS,
  ...BATTLE_ACTIONS,
  ...ROOM_ACTIONS,
};

/** Perform a returned effect on the wire. */
function performEffects(ctx: HandlerContext, room: GameRoom, effects: GameEffect[]): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'robberFightResult':
        ctx.io.to(room.id).emit('robberFightResult', effect.result);
        break;
      case 'pausedInfo':
        broadcastPausedInfo(ctx.io, room.id);
        break;
    }
  }
}

/**
 * Dispatch one client event to its action. Owns the uniform prelude:
 * room lookup (emits 'Room not found'), the cannot-act gate (finished or
 * knocked-out seats can't play), and seat resolution (emits
 * 'Player not found' for actions that need a seat).
 */
export function dispatchAction(
  ctx: HandlerContext,
  event: string,
  payload: { roomId?: string } & Record<string, unknown>
): void {
  const entry = ACTIONS[event];
  if (!entry) {
    ctx.socket.emit('error', { message: `Unknown action: ${event}` });
    return;
  }
  const room = getRoom(payload.roomId ?? '');
  if (!room) {
    ctx.socket.emit('error', { message: 'Room not found' });
    return;
  }
  const player = room.players.find((p) => p.id === ctx.socket.id);
  if (!entry.allowFinished) {
    if (room.gameStatus === 'finished') {
      ctx.socket.emit('error', { message: 'The game is over' });
      return;
    }
    if (player?.eliminated) {
      ctx.socket.emit('error', {
        message: 'You have been knocked out — you can only spectate',
      });
      return;
    }
  }
  const fn = entry.open ?? entry.run;
  if (!entry.open && !player) {
    ctx.socket.emit('error', { message: 'Player not found' });
    return;
  }

  const result = fn?.(room, player as Player, payload, ctx.socket.id) ?? {};
  if (result.error) {
    ctx.socket.emit('error', { message: result.error });
    return;
  }
  if (result.effects) performEffects(ctx, room, result.effects);
  if (result.broadcast !== false) {
    applyBonuses(room);
    broadcastRoom(ctx.io, room, result.broadcast === 'roomUpdate' ? 'roomUpdate' : 'gameUpdate');
  }
}

/**
 * Register every action in the table on this socket — the whole gameplay
 * surface in one loop. `roomId` rides in each payload so the adapter can
 * find the room before dispatching.
 */
export function registerDispatchHandlers(ctx: HandlerContext): void {
  const { socket } = ctx;
  for (const event of Object.keys(ACTIONS)) {
    socket.on(event as never, ((data: { roomId?: string }) =>
      dispatchAction(ctx, event, data ?? {})) as never);
  }
}
