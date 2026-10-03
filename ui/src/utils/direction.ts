import { Board, VertexNode } from 'common';

/**
 * One of the 8 compass directions a soldier move can go, from the selected
 * vertex to an adjacent one (screen space: +x right, +y down).
 */
export const COMPASS_LABELS: string[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** The rotation (degrees, 0 = pointing up) of each compass direction. */
export const COMPASS_ANGLES: number[] = [0, 45, 90, 135, 180, 225, 270, 315];

/** Angular span of one compass sector (degrees; 360 / 8 directions). */
const COMPASS_SPAN = 45;

/**
 * The compass direction (N / NE / E / … / NW) from `from` to `to`, in board
 * screen coordinates (0 deg = up, 90 deg = right, 180 deg = down).
 */
export function directionOf(from: VertexNode, to: VertexNode): string {
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const angle = Math.atan2(dx, -dy);
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  const index = Math.round(deg / COMPASS_SPAN) % COMPASS_LABELS.length;
  return COMPASS_LABELS[index];
}

/**
 * The rotation (degrees, 0 = pointing up) for the direction from `from` to
 * `to`; matches `directionOf`, so the arrow points the way the soldier moves.
 */
export function directionAngleOf(from: VertexNode, to: VertexNode): number {
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const angle = Math.atan2(dx, -dy);
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  return COMPASS_ANGLES[Math.round(deg / COMPASS_SPAN) % COMPASS_ANGLES.length];
}

export interface MoveDirectionTarget {
  /** Compass direction from the selected vertex (N / NE / … / NW). */
  direction: string;
  /** Rotation in degrees (0 = pointing up) for the arrow. */
  angle: number;
  /** Target vertex ids in this direction (usually one). */
  targets: string[];
}

/**
 * The distinct move directions from `vertex` (its road-connected neighbors),
 * each with its arrow angle and target ids. Order follows the vertex's road
 * edges; duplicate directions (two roads to the same vertex) collapse.
 */
export function moveDirectionsFrom(board: Board, vertex: VertexNode): MoveDirectionTarget[] {
  const targets: string[] = [];
  for (const edgeId of vertex.roadIds) {
    const edge = board.edges[edgeId];
    if (!edge || edge.roadId === null) continue; // no road on this edge
    const other = edge.vertexAId === vertex.id ? edge.vertexBId : edge.vertexAId;
    if (!targets.includes(other)) targets.push(other);
  }
  const byDirection = new Map<string, MoveDirectionTarget>();
  for (const targetId of targets) {
    const target = board.vertices[targetId];
    if (!target) continue;
    const direction = directionOf(vertex, target);
    const found = byDirection.get(direction);
    if (found) {
      found.targets.push(targetId);
    } else {
      byDirection.set(direction, {
        direction,
        angle: directionAngleOf(vertex, target),
        targets: [targetId],
      });
    }
  }
  return Array.from(byDirection.values());
}
