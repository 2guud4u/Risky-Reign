/**
 * Board rendering constants: projection, soldier badges, drop targets,
 * robber art placement, viewBox margins, and responsive scale limits.
 */

import { GAME_HEX_SIZE } from 'common';

/** Internal projection size — must match the backend's board projection. */
export const PROJ_SIZE = GAME_HEX_SIZE;

/** Distance from a vertex center to its soldier badges, as a fraction of the hex size. */
export const SOLDIER_BADGE_RADIUS_FRACTION = 0.2;

/** Radius of a soldier badge circle (SVG units). */
export const SOLDIER_BADGE_R = 10;

/** Vertical offset below a vertex center to the soldier badge row, as a fraction of the hex size. */
export const SOLDIER_BADGE_ROW_OFFSET_FRACTION = 0.2;

/** Horizontal gap between adjacent soldier badges in a row. */
export const SOLDIER_BADGE_GAP = 4;

/** Max distance from a target vertex to accept a dropped soldier, as a fraction of the hex size. */
export const DROP_THRESHOLD_FRACTION = 0.45;

/** Radius of the valid drop-target highlight ring (SVG units). */
export const DROP_TARGET_RING_R = 16;

/** Robber image width, as a fraction of the hex size. */
export const ROBBER_W_FRACTION = 1.4;
/** Robber image height, as a fraction of the hex size. */
export const ROBBER_H_FRACTION = 1.05;
/** Robber image top offset above the hex center, as a fraction of the hex size. */
export const ROBBER_Y_OFFSET_FRACTION = 1.05;

/** Fraction of the natural board size added to the viewBox so coast trade ports aren't clipped. */
export const BOARD_VIEWBOX_MARGIN = 1.2;
/** Fraction of the natural board size added on-screen so the hex ring isn't clipped. */
export const BOARD_RENDER_MARGIN = 1.1;
/** Radius of vertex markers on the main board (SVG units). */
export const BOARD_VERTEX_SIZE = 8;
/** Length of a wall sprite (its horizontal reference, end to end) as a
 *  multiple of the edge it stands on. */
export const WALL_LENGTH_FRACTION = .55;
/** Render size of a port-dock icon (SVG units). */
export const PORT_DOCK_SIZE = 8;
/** Max coastal vertices served by one port dock. */
export const PORT_DOCK_MAX_VERTICES = 2;
/** Robber's-bag popup: horizontal offset right of the hex center (SVG units). */
export const ROBBER_BAG_X_OFFSET = 60;
/** Robber's-bag popup: extra upward offset past the robber art (SVG units). */
export const ROBBER_BAG_Y_OFFSET = 47;
/** Robber's-bag popup size (SVG units). */
export const ROBBER_BAG_WIDTH = 150;
export const ROBBER_BAG_HEIGHT = 95;
/** Stroke width of the valid drop-target highlight ring. */
export const DROP_TARGET_STROKE_W = 3;
/** Opacity of the soldier drag ghost. */
export const DRAG_GHOST_OPACITY = 0.6;
/** Opacity of the robber drag ghost. */
export const ROBBER_GHOST_OPACITY = 0.85;
/** Black outline thickness (px, at the default board scale) around white roll numbers so they read over busy terrain art. */
export const ROLL_NUMBER_STROKE_W = 1;
/** Gold used to highlight a hex whose roll number matches the current roll (border, glow, number fill). */
export const LIT_HEX_GOLD = '#FFD700';

/** Minimum scale for responsive board sizing within its panel. */
export const BOARD_MIN_SCALE = 0.5;
/** Maximum scale for responsive board sizing within its panel. */
export const BOARD_MAX_SCALE = 1.25;

/** Board center (the desert hex). */
export const BOARD_CENTER = { q: 0, r: 0, s: 0 };

/**
 * Size of detailed soldiers on the main board relative to the mini view. The
 * mini view lays a garrison out over ~2 vertex-spacings; the board's vertices
 * are 100 units apart, so clusters are scaled down to stay near their vertex.
 */
export const BOARD_SOLDIER_SCALE = 0.5;
