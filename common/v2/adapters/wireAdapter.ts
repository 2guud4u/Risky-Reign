/**
 * Wire adapter: converts the backend's legacy WireBoard (capitalized arrays,
 * numeric vertex ids, pixel coords on pieces) into the clean domain Board.
 *
 * This is the ONLY place the legacy wire format is interpreted; everything
 * downstream works with the domain Board.
 *
 * The legacy backend sends vertices with numeric ids and pixel coords, and
 * hexes with cube coords. We:
 *  1. index legacy vertices by their pixel position (rounded) so we can match
 *     them to canonical vertices generated from the hex layout;
 *  2. re-emit every vertex/edge with a canonical string id;
 *  3. map settlements/roads onto the canonical vertex/edge ids.
 */

import { Board, VertexNode } from '../types/Board';
import { PixelCoord } from '../types/Coordinates';
import { WireBoard } from '../types/Room';
import { generateBoard } from '../utils/boardGenerator';

function pointKey(p: PixelCoord): string {
  return `${Math.round(p.x * 1e3) / 1e3},${Math.round(p.y * 1e3) / 1e3}`;
}

/**
 * Convert a legacy WireBoard into a clean domain Board.
 * @param wire    - board as received from the socket
 * @param hexSize - pixel size used when projecting the hex layout
 */
export function wireBoardToDomain(wire: WireBoard, hexSize: number = 50): Board {
  // Rebuild the domain board from the hex layout (canonical ids + geometry).
  const board = generateBoard(
    wire.Hexes.map((h) => ({ coord: h.coord, terrain: h.terrain, rollNumber: h.rollNumber })),
    { generator: 'wire', hexSize }
  );

  // Index legacy vertices by pixel position.
  const legacyByPoint = new Map<string, (typeof wire.Vertexs)[number]>();
  for (const v of wire.Vertexs) {
    legacyByPoint.set(pointKey(v.coord), v);
  }

  // Map each canonical vertex to its legacy id (for settlement/road lookup).
  const canonicalToLegacy = new Map<string, string>();
  for (const cv of Object.values(board.vertices)) {
    const legacy = legacyByPoint.get(pointKey(cv.position));
    if (legacy) canonicalToLegacy.set(cv.id, String(legacy.id));
  }

  // Attach settlements.
  for (const s of wire.Settlements) {
    const legacyVertexId = String(s.intersect);
    const canonical = Array.from(canonicalToLegacy.entries()).find(([, l]) => l === legacyVertexId)?.[0];
    if (!canonical) continue;
    const settlementId = s.id;
    board.settlements[settlementId] = {
      id: settlementId,
      vertexId: canonical,
      ownerId: s.owner,
      level: s.upgraded ? 'city' : 'settlement',
      builtAt: 0,
    };
    board.vertices[canonical].settlementId = settlementId;
  }

  // Attach roads: match a legacy road to the canonical edge joining the two
  // canonical vertices that correspond to the legacy endpoints.
  const vertexByPosition = new Map<string, VertexNode>();
  for (const v of Object.values(board.vertices)) vertexByPosition.set(pointKey(v.position), v);

  for (const r of wire.Roads) {
    const a = vertexByPosition.get(pointKey(r.coord1));
    const b = vertexByPosition.get(pointKey(r.coord2));
    if (!a || !b) continue;
    const edge = Object.values(board.edges).find(
      (e) =>
        (e.vertexAId === a.id && e.vertexBId === b.id) ||
        (e.vertexAId === b.id && e.vertexBId === a.id)
    );
    if (!edge) continue;
    const roadId = r.id;
    board.roads[roadId] = { id: roadId, edgeId: edge.id, ownerId: r.owner, builtAt: 0 };
    edge.roadId = roadId;
    if (!a.roadIds.includes(edge.id)) a.roadIds.push(edge.id);
    if (!b.roadIds.includes(edge.id)) b.roadIds.push(edge.id);
  }

  return board;
}
