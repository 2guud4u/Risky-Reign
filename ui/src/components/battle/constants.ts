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

/** Vertical lift of a soldier icon, as a multiple of TROOP_R. */
export const SOLDIER_ICON_LIFT = 1.15;

/** Soldier icon footprint, as a multiple of TROOP_R. */
export const SOLDIER_ICON_WIDTH = 2;
export const SOLDIER_ICON_HEIGHT = 2.3;

/**
 * The soldier art fills only part of its box (its viewBox is tall and thin),
 * so the drawn figure is this fraction of SOLDIER_ICON_WIDTH wide. Used to
 * size the click target to the figure, not the empty box around it.
 */
export const SOLDIER_FIGURE_WIDTH_FRAC = 0.5;

/**
 * robber.png's opaque figure inside its 1408×768 canvas (pixels). The robber
 * is drawn by this box, scaled to the soldier's figure height, so both
 * troops read the same size.
 */
export const ROBBER_ART = { canvasW: 1408, canvasH: 768, x: 524, y: 92, w: 402, h: 601 };

/** Default label size for an unrolled troop marker. */
export const TROOP_LABEL_SIZE = 10;

/** Label size once the troop's die value is shown. */
export const TROOP_ROLL_LABEL_SIZE = 13;

/** Dark disc behind a rolled die value so it reads on any owner color. */
export const TROOP_ROLL_BADGE_FILL = 'rgba(17, 24, 39, 0.75)';
/** Badge radius, as a multiple of TROOP_ROLL_LABEL_SIZE. */
export const TROOP_ROLL_BADGE_R = 0.8;

/** Dark outline around every troop label (drawn under the white fill). */
export const TROOP_LABEL_OUTLINE = 'rgba(17, 24, 39, 0.9)';
export const TROOP_LABEL_OUTLINE_WIDTH = 3;
