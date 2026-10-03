import { PublicGameRoom, SoldierObj } from 'common';

/** Map of player name -> chosen color (for tinting pieces per owner). */
export const playerColorMap = (gameRoom: PublicGameRoom | null): Record<string, string> =>
  Object.fromEntries((gameRoom?.players ?? []).map((p) => [p.name, p.color]));

/**
 * Group soldiers by owner, preserving first-seen order of each owner.
 */
export const groupSoldiersByOwner = (soldiers: SoldierObj[]): Map<string, SoldierObj[]> => {
  const byOwner = new Map<string, SoldierObj[]>();
  for (const s of soldiers) {
    const arr = byOwner.get(s.owner) ?? [];
    arr.push(s);
    byOwner.set(s.owner, arr);
  }
  return byOwner;
};