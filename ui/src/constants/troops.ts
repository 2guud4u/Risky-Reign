/**
 * Troop art and garrison-formation constants: sprite sizes, formation grid
 * spacing, the count pill, and the action-check badge.
 */
/**
 * Drawn size (board px, before BOARD_SOLDIER_SCALE) of every troop sprite.
 * Sized so the people match: each sprite is scaled until its face is the
 * same height as the healthy soldier's, then its trimmed canvas gives the
 * box. Pieces stand on a shared ground line (sprite bottom = feet).
 */
export const TROOP_ART = {
  soldier: { w: 28.94, h: 66 },
  injured: { w: 34.25, h: 46.33 },
  cannonStationed: { w: 71.23, h: 69.56 },
  cannonUnstationed: { w: 56.98, h: 47.74 },
} as const;
/** Healthy-soldier art size — the reference the formation grid is built on. */
export const SOLDIER_ART_WIDTH = TROOP_ART.soldier.w;
export const SOLDIER_ART_HEIGHT = TROOP_ART.soldier.h;

// Garrison formation: each owner's soldiers stand in tidy ranks — healthy in
// front, injured behind — with a count pill once the army is too big to draw.
// Sized so two armies side by side stay inside one vertex spacing on the board.
/** Slots per rank (row) in a formation: a cannon takes 2 slots, any other troop 1. */
export const FORMATION_COLS = 4;
/** Most soldiers drawn per army; bigger armies show their total in a count pill. */
export const FORMATION_MAX_VISIBLE = 20;
/** Horizontal distance between soldiers in a rank (about one art width). */
export const FORMATION_COL_SPACING = 30;
/** How far each rank further back sits above the one in front of it. */
export const FORMATION_ROW_SPACING = 24;
/** Gap between neighboring armies on the same vertex. */
export const FORMATION_ARMY_GAP = 28;
/** Widest a line of armies may get before the next army wraps to a new line below. */
export const FORMATION_LINE_MAX_WIDTH = 220;
/** Count pill ("×12") height, font size and gap below an army's front rank. */
export const FORMATION_PILL_H = 22;
export const FORMATION_PILL_FONT = 15;
export const FORMATION_PILL_GAP = 4;
/** Count pill width per character of its label, plus side padding. */
export const FORMATION_PILL_CHAR_W = 9;
export const FORMATION_PILL_PAD = 8;
/** Space between wrapped lines of armies. */
export const FORMATION_LINE_GAP = 12;
/** Selected-soldier check badge: radius as a fraction of the art width. */
export const CHECK_BADGE_R_FRAC = 0.16;
/** Selected-soldier check badge: gap above the sprite's top edge (as a fraction of soldier art height). */
export const CHECK_BADGE_Y_OFF = 0.05;
export const CHECK_BADGE_COLOR = '#16a34a';

/** Energy bolt marking a soldier with an unspent action (mini-map). */
/** Bolt height as a fraction of the soldier art height. */
export const ACTION_BOLT_H_FRAC = 0.35;
/** Bolt width as a fraction of its own height. */
export const ACTION_BOLT_W_FRAC = 0.55;
/** Bolt center offset: 0 = centered on the soldier. */
export const ACTION_BOLT_X_OFF = 0;
/** Bolt center offset: 0 = centered on the soldier. */
export const ACTION_BOLT_Y_OFF = 0;
/** Bolt fill / outline colors. */
export const ACTION_BOLT_FILL = '#facc15';
export const ACTION_BOLT_STROKE = '#92680e';
