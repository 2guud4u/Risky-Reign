import { BoardUIState, EdgeId, VertexId } from 'common';

/**
 * Detects builds between two consecutive presentation board states so every
 * client (builder and observers alike) plays the same piece animation from
 * the same room broadcast.
 *
 * Only settlement placement, city upgrade and road placement animate; the
 * other buildables (soldier, ship, wall) render instantly. A `null` previous
 * board is treated as "already baseline" (join/rejoin) — existing pieces
 * don't replay their entrance.
 */
export interface BuildChange {
  kind: 'settlement' | 'city' | 'road';
  id: VertexId | EdgeId;
}

export function diffBuilds(prev: BoardUIState | null, next: BoardUIState): BuildChange[] {
  if (!prev) return [];
  const out: BuildChange[] = [];
  for (const [id, v] of Object.entries(next.vertices)) {
    const pv = prev.vertices[id];
    if (!pv) continue;
    if (v.hasSettlement && !pv.hasSettlement)
      out.push({ kind: 'settlement', id });
    else if (v.settlementLevel === 'city' && pv.settlementLevel === 'settlement')
      out.push({ kind: 'city', id });
  }
  for (const [id, e] of Object.entries(next.edges)) {
    const pe = prev.edges[id];
    if (!pe) continue;
    if (e.hasRoad && !pe.hasRoad) out.push({ kind: 'road', id });
  }
  return out;
}
