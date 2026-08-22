/**
 * UI-only presentation constants (SVG layout sizes, spacings, thresholds).
 *
 * Domain values that must stay in sync with the backend (hex sizes, prices,
 * limits) live in `common/Constant.ts` and `common/utils/logic.ts` instead —
 * only pure rendering knobs belong here.
 */

import { GAME_HEX_SIZE } from 'common';

// ── BoardView ────────────────────────────────────────────────────────────────

/** Internal projection size — must match the backend's board projection. */
export const PROJ_SIZE = GAME_HEX_SIZE;

/** Distance from a vertex center to its soldier badges, as a fraction of the hex size. */
export const SOLDIER_BADGE_RADIUS_FRACTION = 0.2;

/** Radius of a soldier badge circle (SVG units). */
export const SOLDIER_BADGE_R = 10;

/** Max distance from a target vertex to accept a dropped soldier, as a fraction of the hex size. */
export const DROP_THRESHOLD_FRACTION = 0.45;

/** Radius of the valid drop-target highlight ring (SVG units). */
export const DROP_TARGET_RING_R = 16;

// ── MiniView ─────────────────────────────────────────────────────────────────

/** Distance from the vertex center to the first soldier rank row. */
export const RANK_OFFSET = 26;

/** Vertical spacing between consecutive rank rows. */
export const RANK_SPACING = 13;

/** Horizontal spacing between soldiers within a rank row. */
export const SOLDIER_SPACING = 15;
