import { RefObject, ReactNode, MouseEvent } from 'react';
import { Board, EdgeNode, HexNode, PixelCoord, VertexNode } from 'common';
import { GarrisonArmy } from '../utils/garrisonFormation';

/**
 * Types shared by the mini-map preview (MiniView) and its extracted
 * components under `components/miniMap/`.
 */

export interface MiniViewProps {
  board: Board;
  type: 'vertex';
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
  /** Extra classes for the SVG (e.g. `h-full` to fit a fixed-height container). */
  className?: string;
}

/** Stroke style for an edge line in the mini map (thicker when a road is built). */
export interface RoadStroke {
  color: string;
  width: number;
}

/** A neighbor vertex reached over an edge, with its optional letter label. */
export interface VertexNeighbor {
  edge: EdgeNode;
  vertex: VertexNode;
  /** Label anchor (just outside the circle, away from the selected vertex). */
  labelPos?: PixelCoord;
  /** Bounding box corners of the label glyph, so the viewBox fits it fully. */
  labelBounds?: PixelCoord[];
  /** The label text ('a', 'b', 'c', …), stable per neighbor vertex. */
  label?: string;
}

/** Pure layout for a selected vertex: what to draw and which points size the view. */
export interface VertexMiniLayout {
  vertex: VertexNode;
  neighbors: VertexNeighbor[];
  /** Garrison armies around the vertex (empty when suppressed or none). */
  armies: GarrisonArmy[];
  /** Whether the selected vertex holds a settlement/city (drives the marker vs. dot). */
  hasSettlement: boolean;
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
