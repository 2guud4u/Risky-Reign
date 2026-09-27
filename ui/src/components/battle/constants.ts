/**
 * Display constants for the battle window's troops and mini-map. Layout
 * constants (spacing, radii, drop thresholds) live in `constants.ts`; these
 * are local to the battle window's SVG art.
 */

/** Minimum render size for the enlarged battle mini-map (MiniView). */
export const BATTLE_MINI_MIN_VIEW_SIZE = 300;

/** Opacity of a dead troop's icon. */
export const DEAD_TROOP_OPACITY = 0.4;

/** Injured troops render at 0.65x the size of a healthy troop. */
export const INJURED_TROOP_SCALE = 0.65;

/** Vertical lift of the robber icon, as a multiple of TROOP_R. */
export const ROBBER_ICON_LIFT = 1.6;

/** Vertical lift of a soldier icon, as a multiple of TROOP_R. */
export const SOLDIER_ICON_LIFT = 1.15;

/** Soldier icon footprint, as a multiple of TROOP_R. */
export const SOLDIER_ICON_WIDTH = 2;
export const SOLDIER_ICON_HEIGHT = 2.3;

/** Default label size for an unrolled troop marker. */
export const TROOP_LABEL_SIZE = 10;

/** Label size once the troop's die value is shown. */
export const TROOP_ROLL_LABEL_SIZE = 13;
