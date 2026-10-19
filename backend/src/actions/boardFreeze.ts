import { boardBusy } from 'common';
import type { ActionEntry } from '../dispatch';

/**
 * Piece actions (move, attack, capture, heal, cannon, ship, wall, Knight
 * spawn, building a piece) are refused while a battle or an open wall gate
 * freezes the board (`boardBusy`). Wraps the named entries of an action table
 * so the rule holds on every caller — dispatch and headless tests alike. The
 * battle's and the gate's own actions are simply not listed.
 */
export function freezeWhileBusy<T extends Record<string, ActionEntry>>(table: T, names: (keyof T)[]): T {
  for (const name of names) {
    const run = table[name].run!;
    table[name] = {
      ...table[name],
      run: (room, player, payload, socketId) => {
        const busy = boardBusy(room);
        return busy ? { error: busy } : run(room, player, payload, socketId);
      },
    };
  }
  return table;
}
