import { TurnState } from '../types/Logic';

/** Where the turn machine stands: whose turn, which phase, and the round counters. */
export type TurnPosition = Pick<TurnState, 'phase' | 'player' | 'playerOrder' | 'offset' | 'dicePlayerIndex'>;

/**
 * The turn position after the current one ends. Single source of truth for
 * turn order — the backend's `advanceTurn` applies it, the turn timeline
 * forecasts with it.
 * - SetUp: two rounds, clockwise then counterclockwise, then the first
 *   player's Dice phase.
 * - Dice → the same player's Build phase.
 * - Build / Action: every player in turn, starting from the dice player;
 *   after the last, Build → Action (dice player first), Action → the next
 *   dice player's Dice phase.
 * Knocked-out players (`out`) get no turns: their Build/Action steps are
 * skipped and they never own a dice round.
 */
export function nextTurnPosition(pos: TurnPosition, out: readonly string[] = []): TurnPosition {
  const { playerOrder: order } = pos;
  const n = order.length;
  const next = (cur: TurnPosition, phase: TurnPosition['phase'], playerIndex: number, nextOffset: number, dice = cur.dicePlayerIndex ?? 0): TurnPosition => ({
    phase,
    player: order[playerIndex],
    playerOrder: order,
    offset: nextOffset,
    dicePlayerIndex: dice,
  });
  const step = (cur: TurnPosition): TurnPosition => {
    const { offset } = cur;
    const d = cur.dicePlayerIndex ?? 0;
    switch (cur.phase) {
      case 'SetUp': {
        if (offset === n * 2 - 1) return next(cur, 'Dice', 0, 0, 0);
        const o = offset + 1;
        // First round clockwise (A→B→C), second counterclockwise (C→B→A).
        return next(cur, 'SetUp', o < n ? o : n - 1 - (o - n), o);
      }
      case 'Dice':
        return next(cur, 'Build', order.indexOf(cur.player), 0);
      case 'Build':
        if (offset === n - 1) return next(cur, 'Action', d, 0);
        return next(cur, 'Build', (order.indexOf(cur.player) + 1) % n, offset + 1);
      case 'Action':
        if (offset === n - 1) {
          // The next dice round goes to the next player still in the game.
          let nd = (d + 1) % n;
          for (let i = 0; i < n && out.includes(order[nd]); i++) nd = (nd + 1) % n;
          return next(cur, 'Dice', nd, 0, nd);
        }
        return next(cur, 'Action', (order.indexOf(cur.player) + 1) % n, offset + 1);
    }
  };
  // Skip knocked-out players' steps; bounded so an all-out order can't spin.
  let cur = step(pos);
  for (let i = 0; i < 2 * n && out.includes(cur.player); i++) cur = step(cur);
  return cur;
}

/** The next `count` turn positions after `pos` (stops early if the order is empty). */
export function upcomingTurns(pos: TurnPosition, count: number, out: readonly string[] = []): TurnPosition[] {
  const turns: TurnPosition[] = [];
  if (pos.playerOrder.length === 0) return turns;
  let cur = pos;
  for (let i = 0; i < count; i++) {
    cur = nextTurnPosition(cur, out);
    turns.push(cur);
  }
  return turns;
}
