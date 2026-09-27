import { RefObject, ReactNode, MouseEvent } from 'react';
import { Board, EdgeNode, HexNode, PixelCoord, SoldierObj, VertexNode } from 'common';

/**
 * Types shared by the mini-map preview (MiniView) and its extracted
 * components under `components/miniMap/`.
 */

export interface MiniViewProps {
  board: Board;
  type: 'vertex' | 'edge';
  id: string;
  /** Player name -> color, used to tint soldier circles. */
  playerColors?: Record<string, string>;
  /** Click handler for soldiers (toggles them in the selected group). */
  onSoldierClick?: (soldierId: string) => void;
  /** Soldier ids currently in the selected group (highlighted). */
  selectedSoldierIds?: ReadonlySet<string>;
  /** Soldier ids the current player may click to select for a group action. */
  selectableSoldierIds?: ReadonlySet<string>;
  /** Soldier ids with an unspent action (pulsed to show they can still be used). */
  canActSoldierIds?: ReadonlySet<string>;
  /**
   * When false, the default garrisoned-soldier rendering at the selected
   * vertex is skipped (used by the battle arena, which draws its own
   * combatants).
   */
  showGarrisonedSoldiers?: boolean;
  /**
   * Extra content rendered on top of the map, in the same world-coordinate
   * space centered on the selected object (used by the battle arena).
   */
  children?: ReactNode;
  /**
   * External ref for the SVG element (so the battle window can map mouse
   * coordinates into world space for drag-and-drop).
   */
  svgRef?: RefObject<SVGSVGElement>;
  /** SVG-level mouse handlers (for drag-and-drop overlays). */
  onMouseMove?: (e: MouseEvent<SVGSVGElement>) => void;
  onMouseUp?: (e: MouseEvent<SVGSVGElement>) => void;
  onMouseLeave?: (e: MouseEvent<SVGSVGElement>) => void;
  /**
   * Minimum world-space size for the viewBox (squared). When set, the view is
   * at least this large even if the board neighborhood is smaller — used by
   * the battle arena so a wide troop formation isn't zoomed in too much.
   */
  minViewSize?: number;
  /** The current player's name (used to separate own troops from enemy groups). */
  currentPlayer?: string;
}

/** Stroke style for an edge line in the mini map (thicker when a road is built). */
export interface RoadStroke {
  color: string;
  width: number;
}

/** One owner's garrisoned-soldier cluster: its anchor and bounding radius. */
export interface GarrisonCluster {
  ownerName: string;
  group: SoldierObj[];
  anchor: PixelCoord;
  /** Bounding radius used for viewBox fitting and cluster separation. */
  radius: number;
}

/** A neighbor vertex reached over an edge, with its optional letter label. */
export interface VertexNeighbor {
  edge: EdgeNode;
  vertex: VertexNode;
  /** Label anchor (just outside the circle, away from the selected vertex). */
  labelPos?: PixelCoord;
  /** Bounding box corners of the label glyph, so the viewBox fits it fully. */
  labelBounds?: PixelCoord[];
  /** The label text ('a', 'b', 'c', …), matching the sidebar's buttons. */
  label?: string;
}

/** Pure layout for a selected vertex: what to draw and which points size the view. */
export interface VertexMiniLayout {
  vertex: VertexNode;
  neighbors: VertexNeighbor[];
  /** Garrison clusters around the vertex (empty when suppressed or none). */
  clusters: GarrisonCluster[];
  /** Whether the selected vertex holds a settlement/city (drives the marker vs. dot). */
  hasSettlement: boolean;
  hexes: HexNode[];
  points: PixelCoord[];
  focus: PixelCoord;
}

/** Pure layout for a selected edge. */
export interface EdgeMiniLayout {
  edge: EdgeNode;
  endpoints: [VertexNode, VertexNode];
  /** Road owner id at this edge, or null (colors the selected-edge line). */
  roadOwnerId: string | null;
  hexes: HexNode[];
  points: PixelCoord[];
  focus: PixelCoord;
}

/** Centered square viewBox covering the mini-map content. */
export interface MiniViewBox {
  x: number;
  y: number;
  size: number;
}
