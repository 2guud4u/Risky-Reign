/**
 * Display constants for the battle window's troops and mini-map. Layout
 * constants (spacing, radii, drop thresholds) live in `src/constants/`; these
 * are local to the battle window's SVG art.
 */

/** Minimum render size for the enlarged battle mini-map (MiniView). */
export const BATTLE_MINI_MIN_VIEW_SIZE = 300;

/** Opacity of a dead troop's icon. */
export const DEAD_TROOP_OPACITY = 0.4;

/** Vertical lift of a soldier icon, as a multiple of TROOP_R. */
export const SOLDIER_ICON_LIFT = 1.15;

/** Healthy-soldier figure height, as a multiple of TROOP_R. Every other troop
 *  sprite is sized relative to it by `TROOP_ART` (people-matched). */
export const SOLDIER_ICON_HEIGHT = 2.3;

/**
 * Bobbing finger beside the next troop to roll (👉 left of an attacker, 👈
 * right of a defender — the open side, so it never covers a stacked troop's
 * number): glyph size and gap from the figure's edge (SVG px).
 */
export const ROLL_FINGER_SIZE = 30;
export const ROLL_FINGER_GAP = 2;

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
