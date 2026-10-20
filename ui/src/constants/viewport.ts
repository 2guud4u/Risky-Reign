/**
 * Viewport gesture constants (useBoardViewport): zoom limits and steps, pan /
 * pinch thresholds, hit-test padding, and the click-to-focus animation.
 */

/** Zoom limits relative to the board's natural (zoom-1) size. */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 6;
/** Zoom step per wheel tick / button press. */
export const ZOOM_STEP = 1.15;
/** Minimum pointer movement (px) before a press counts as a pan. */
export const PAN_THRESHOLD = 4;
/** Smallest distance (px) between two touch points before a pinch zooms. */
export const PINCH_MIN_DIST = 12;
/** Transparent hit-line width (board units) for selecting/pressing a road; the visible road stays thin. */
export const ROAD_HIT_WIDTH = 26;
/** Invisible hit ring radius on a board vertex, in multiples of the vertex
 *  size — fingertip-sized taps land at board-fit zoom. */
export const VERTEX_HIT_SCALE = 1.75;
/** Extra invisible hit radius (board units) around a soldier count badge. */
export const BADGE_HIT_PAD = 8;
/**
 * Minimum zoom for individual soldier SVGs instead of count badges.
 */
export const DETAIL_ZOOM_IN = 4;
/**
 * Zoom the board animates to when a vertex or edge is clicked (never zooms
 * out). Kept above DETAIL_ZOOM_IN so selecting always shows the individual
 * soldiers, not their count badges.
 */
export const SELECT_FOCUS_ZOOM = DETAIL_ZOOM_IN * 1.15;
/** Duration of the click-to-focus animation, in ms. */
export const FOCUS_DURATION_MS = 350;
/** Margin (board units) around the sail pick-mode zoom-to-fit box. */
export const SAIL_FIT_PADDING = 40;
/** Pointer drift (screen px) between press and release that still counts as
 *  a click — sail pick mode ignores commits from pans that ended in place. */
export const SAIL_CLICK_DRIFT_PX = 8;
