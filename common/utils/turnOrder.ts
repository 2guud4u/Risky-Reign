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
 */
export function nextTurnPosition(pos: TurnPosition): TurnPosition {
  const { playerOrder: order, offset } = pos;
  const n = order.length;
  const d = pos.dicePlayerIndex ?? 0;
  const next = (phase: TurnPosition['phase'], playerIndex: number, nextOffset: number, dice = d): TurnPosition => ({
    phase,
    player: order[playerIndex],
    playerOrder: order,
    offset: nextOffset,
    dicePlayerIndex: dice,
  });
  switch (pos.phase) {
    case 'SetUp': {
      if (offset === n * 2 - 1) return next('Dice', 0, 0, 0);
      const o = offset + 1;
      // First round clockwise (A→B→C), second counterclockwise (C→B→A).
      return next('SetUp', o < n ? o : n - 1 - (o - n), o);
    }
    case 'Dice':
      return next('Build', order.indexOf(pos.player), 0);
    case 'Build':
      if (offset === n - 1) return next('Action', d, 0);
      return next('Build', (order.indexOf(pos.player) + 1) % n, offset + 1);
    case 'Action':
      if (offset === n - 1) {
        const nd = (d + 1) % n;
        return next('Dice', nd, 0, nd);
      }
      return next('Action', (order.indexOf(pos.player) + 1) % n, offset + 1);
  }
}

/** The next `count` turn positions after `pos` (stops early if the order is empty). */
export function upcomingTurns(pos: TurnPosition, count: number): TurnPosition[] {
  const out: TurnPosition[] = [];
  if (pos.playerOrder.length === 0) return out;
  let cur = pos;
  for (let i = 0; i < count; i++) {
    cur = nextTurnPosition(cur);
    out.push(cur);
  }
  return out;
}

/**
 * Short labels for what a player can do at a turn position. Trading is open
 * to the round's dice player in any phase after setup; dev cards can be
 * played on any of your own turns after setup.
 */
export function turnActions(pos: TurnPosition): string[] {
  const diceOwner = pos.playerOrder[pos.dicePlayerIndex ?? 0];
  const trade = pos.player === diceOwner ? ['Trade'] : [];
  switch (pos.phase) {
    case 'SetUp':
      return ['Place settlement', 'Place road'];
    case 'Dice':
      return ['Roll dice', 'Play dev card', ...trade];
    case 'Build':
      return ['Build', 'Buy dev card', 'Play dev card', ...trade];
    case 'Action':
      return ['Recruit', 'Move', 'Heal', 'Attack', 'Capture', 'Play dev card', ...trade];
  }
}
