import { Board, PublicGameRoom, PixelCoord, SoldierObj } from 'common';

/**
 * Pure helpers for board pointer interaction: drag eligibility, drop-target
 * resolution and screen-to-SVG coordinate conversion.
 */

/** True while this soldier may still take an action this turn. */
export const soldierMovableThisTurn = (s: SoldierObj, gameRoom: PublicGameRoom): boolean =>
  !gameRoom.turnState.soldiersActedThisTurn.includes(s.id) &&
  !gameRoom.turnState.soldiersCreatedThisTurn.includes(s.id) &&
  !gameRoom.turnState.soldiersHealedThisTurn.includes(s.id);

/**
 * A soldier badge is draggable only during the current player's Action phase,
 * and only when at least one of that owner's soldiers at the vertex can still
 * move (mirrors the flags canMoveSoldierTo enforces on the backend).
 */
export function isSoldierDraggable(
  gameRoom: PublicGameRoom | null,
  playerName: string | undefined,
  ownerName: string,
  vertexId: string
): boolean {
  if (!gameRoom) return false;
  if (gameRoom.turnState.phase !== 'Action') return false;
  if (gameRoom.turnState.player !== playerName) return false;
  if (playerName !== ownerName) return false;
  return Object.values(gameRoom.board?.soldiers ?? {}).some(
    (s) => s.vertexId === vertexId && s.owner === ownerName && soldierMovableThisTurn(s, gameRoom)
  );
}

/**
 * The first movable soldier this owner has at the vertex (skips ones that
 * already acted / were just built / were just healed this turn).
 */
export function movableSoldierAt(
  board: Board,
  gameRoom: PublicGameRoom,
  vertexId: string,
  ownerName: string
): SoldierObj | null {
  return (
    Object.values(board.soldiers).find(
      (s) =>
        s.vertexId === vertexId &&
        s.owner === ownerName &&
        soldierMovableThisTurn(s, gameRoom)
    ) ?? null
  );
}

/**
 * Valid drop targets for a soldier leaving `vertexId`: the far end of every
 * road-connected edge. (Soldiers can only move along owned-road adjacency.)
 */
export function validSoldierTargets(board: Board, vertexId: string): string[] {
  const validTargets: string[] = [];
  const v = board.vertices[vertexId];
  if (!v) return validTargets;
  for (const edgeId of v.roadIds) {
    const edge = board.edges[edgeId];
    if (!edge || edge.roadId === null) continue; // no road on this edge
    const other = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
    validTargets.push(other);
  }
  return validTargets;
}

/**
 * Convert a mouse event to SVG world coordinates using the element's current
 * transform matrix (so pan/zoom are accounted for).
 */
export function mouseToSvgPoint(
  e: { clientX: number; clientY: number },
  svg: SVGSVGElement | null
): PixelCoord | null {
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/**
 * The nearest item (by `positionOf`) to `pos`, within `maxDist`. Items whose
 * position resolves to null are skipped (e.g. a stale vertex id).
 */
export function nearestWithin<T>(
  items: Iterable<T>,
  pos: PixelCoord,
  maxDist: number,
  positionOf: (item: T) => PixelCoord | null
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const p = positionOf(item);
    if (!p) continue;
    const d = Math.hypot(p.x - pos.x, p.y - pos.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best !== null && bestDist <= maxDist ? best : null;
}
