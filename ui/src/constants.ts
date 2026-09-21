/**
 * UI-only presentation constants (SVG layout sizes, spacings, thresholds).
 *
 * Domain values that must stay in sync with the backend (hex sizes, prices,
 * limits) live in `common/Constant.ts` instead — only pure rendering knobs
 * belong here.
 */

import { GAME_HEX_SIZE, Price } from 'common';

// ── BoardView ────────────────────────────────────────────────────────────────

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

// ── MiniView ─────────────────────────────────────────────────────────────────

/** Distance from the vertex center to the first soldier rank row. */
export const RANK_OFFSET = 34;

/** Vertical spacing between consecutive rank rows. */
export const RANK_SPACING = 70;

/** Horizontal spacing between soldiers within a rank row. */
export const SOLDIER_SPACING = 30;

// ── BoardView (scale) ─────────────────────────────────────────────────────

/** Minimum scale for responsive board sizing within its panel. */
export const BOARD_MIN_SCALE = 0.5;
/** Maximum scale for responsive board sizing within its panel. */
export const BOARD_MAX_SCALE = 1.25;

// ── GameLogic ──────────────────────────────────────────────────────────────

/** How long (ms) a transient error toast stays visible before auto-dismissing. */
export const TOAST_DURATION_MS = 4000;

// ── BattleModal ────────────────────────────────────────────────────────────

/** Distance of each side's formation from the vertex center (world units). */
export const SIDE_OFFSET = 130;
/** Rolled troops stop this far inside the center clash line. */
export const CENTER_GAP = 15;
/** Vertical spacing between troops in a line. */
export const ROW_H = 34;
/** Troop circle radius. */
export const TROOP_R = 26;
/** Small soldier dot radius — matches how garrisoned soldiers are drawn in MiniView. */
export const SOLDIER_DOT_R = 6;
/** Horizontal spacing between columns of the waiting line. */
export const COL_W = 34;
/** Maximum troops in a single column of the waiting line. */
export const SIDE_COL_MAX = 6;
/** Horizontal spacing between troops in a repositioning row. */
export const REPOSITION_ROW_SPACING = 44;
/** Distance below the vertex center where the repositioning row sits. */
export const REPOSITION_ROW_OFFSET_Y = 60;
/** Rendered width of the injured-soldier icon in the repositioning view. */
export const REPOSITION_SOLDIER_W = 40;
/** Rendered height of the injured-soldier icon in the repositioning view. */
export const REPOSITION_SOLDIER_H = 46;
/** Neighbor vertex circle radius in the MiniView. */
export const MINI_NEIGHBOR_R = 8;
/** Selection ring radius in the MiniView. */
export const MINI_SELECT_RING_R = 15;
/** Selection circle radius in the MiniView. */
export const MINI_SELECT_CIRCLE_R = 11;
/** Highlight rectangle width in the MiniView. */
export const MINI_HIGHLIGHT_W = 30;
/** Highlight rectangle height in the MiniView. */
export const MINI_HIGHLIGHT_H = 70;

// ── ResourceGainLayer ──────────────────────────────────────────────────────

/** ms per card flight. */
export const GAIN_DURATION = 5000;
/** ms offset between successive cards. */
export const GAIN_STAGGER = 1100;
/** ms per card flight for the spend (build) animation. */
export const SPEND_DURATION = 5000;
/** ms offset between successive cards for the spend animation. */
export const SPEND_STAGGER = 1100;
/** Board center (the desert hex). */
export const BOARD_CENTER = { q: 0, r: 0, s: 0 };

// ── DraggablePanel ─────────────────────────────────────────────────────────

/** Minimum pointer movement (px) before a press counts as a drag. */
export const DRAG_THRESHOLD = 5;

// ── BoardVertex (port) ─────────────────────────────────────────────────────

/** Port (harbor) presentation — all sized relative to the vertex `size`. */
/** How far past the vertex the badge sits (into the water). */
export const PORT_OFFSET = 5;
/** Badge radius. */
export const PORT_RADIUS = 2.2;
/** White ring around the badge, as an extra radius (contrast vs. water). */
export const PORT_RING = 1.4;
/** Glyph font size. */
export const PORT_TEXT = 1.7;
/** Generic port fill (3:1) — warm amber. */
export const PORT_GENERIC_FILL = '#c9971f';
/** Special port fill (2:1) — pleasant blue. */
export const PORT_SPECIAL_FILL = '#4a90d9';
/** Port outline. */
export const PORT_STROKE = '#2a3a4a';
/** Pier (dock road) fill — wood. */
export const PORT_PIER = '#b08d57';
/** Pier edge — darker wood. */
export const PORT_PIER_EDGE = '#6e5230';

// ── Game (layout) ──────────────────────────────────────────────────────────

/** Width of the sidebar. */
export const SIDEBAR_W = 420;

// ── useBoardViewport ───────────────────────────────────────────────────────

/** Zoom limits relative to the board's natural (zoom-1) size. */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
/** Zoom step per wheel tick / button press. */
export const ZOOM_STEP = 1.15;
/** Minimum pointer movement (px) before a press counts as a pan. */
export const PAN_THRESHOLD = 4;

// ── useBuildRules ──────────────────────────────────────────────────────────

/** "Afford any price" resource counts for free (Road Card) builds. */
export const UNLIMITED_RESOURCES: Price = { Wood: 99, Brick: 99, Sheep: 99, Wheat: 99, Ore: 99 };

// ── Trade / Dice ───────────────────────────────────────────────────────────

/** Zeroed price, used as a starting accumulator for resource gains. */
export const emptyPrice: Price = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };
