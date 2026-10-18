import { BoardEdge, BoardHex, BoardVertex, PixelCoord, PortType } from 'common';

/**
 * Types shared by the full-board renderer (BoardView) and its extracted
 * layer components under `components/board/`.
 */

export interface BoardViewProps {
  /** On-screen render size (lobby preview vs. full game). */
  hexSize: number;
}

/** A BoardVertex plus the ephemeral interaction/owner state layered on at render time. */
export interface BoardVertexRender extends BoardVertex {
  ownerColor?: string;
}

/** A BoardEdge plus the ephemeral interaction/owner state layered on at render time. */
export interface BoardEdgeRender extends BoardEdge {
  ownerColor?: string;
  /** The road on this edge is a wall (blocks enemy crossings). */
  isWall?: boolean;
}

/**
 * A trade-port dock: 1-2 adjacent coastal vertices served by one harbor icon
 * (see `groupPortVertices` in `utils/boardPresentation.ts`).
 */
export interface PortGroup {
  port: PortType;
  vertices: PixelCoord[];
}

/** In-progress soldier drag: which soldier left which vertex, and where it may land. */
export interface SoldierDragState {
  soldierId: string;
  ownerName: string;
  fromVertexId: string;
  validTargets: string[];
}

/**
 * Post-drop ghost animation: a drag that just ended keeps its ghost alive
 * briefly, springing to the drop point (a landed target) or snapping back to
 * the origin (an invalid drop). Rendered by DragOverlays; cleared when the
 * spring finishes (or instantly under reduced motion).
 */
export interface DragSettle {
  kind: 'soldier' | 'robber';
  /** Starting position (cursor at mouse-up), in SVG world coords. */
  from: PixelCoord;
  /** Landing position: the target for a hit, the origin for a miss. */
  to: PixelCoord;
  /** Ghost tint (soldier only). */
  color?: string;
}

/**
 * Presentation board layered with interaction state, ready for the SVG
 * layer components (vertices/edges carry hover/select flags and owner colors;
 * hexes render as-is).
 */
export interface BoardRenderState {
  vertices: BoardVertexRender[];
  edges: BoardEdgeRender[];
  hexes: BoardHex[];
}
