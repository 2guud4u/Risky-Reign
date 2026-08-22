import { Board, GameRoom, SoldierObj } from 'common';

/** Map of player name -> chosen color (for tinting pieces per owner). */
export const playerColorMap = (gameRoom: GameRoom | null): Record<string, string> =>
  Object.fromEntries((gameRoom?.players ?? []).map((p) => [p.name, p.color]));

/** Number of soldiers per rank row in the mini view. */
export const SOLDIERS_PER_ROW = 3;

/**
 * Presentation helpers for laying out garrisoned soldiers around a vertex.
 *
 * Both the main board (BoardView) and the sidebar mini view (MiniView) render
 * each player's troops as circles arranged radially around the vertex. Keeping
 * the grouping + angle math here ensures the two views stay visually
 * consistent instead of drifting apart.
 */

/** Soldiers garrisoned at a vertex that are not injured. */
export const soldiersAtVertex = (board: Board, vertexId: string): SoldierObj[] =>
  Object.values(board.soldiers ?? {}).filter((s) => s.vertexId === vertexId && !s.injured);

/** Group soldiers by owner, preserving first-seen order of each owner. */
export const groupSoldiersByOwner = (soldiers: SoldierObj[]): Map<string, SoldierObj[]> => {
  const byOwner = new Map<string, SoldierObj[]>();
  for (const s of soldiers) {
    const arr = byOwner.get(s.owner) ?? [];
    arr.push(s);
    byOwner.set(s.owner, arr);
  }
  return byOwner;
};

/**
 * Radial angle for the i-th owner out of n, evenly spaced and starting at the
 * top (12 o'clock). Shared by both views so they agree on orientation.
 */
export const ownerAngle = (index: number, count: number): number =>
  (index / count) * Math.PI * 2 - Math.PI / 2;
