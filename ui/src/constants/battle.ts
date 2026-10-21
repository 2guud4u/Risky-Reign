/**
 * Battle window layout constants: formation offsets, troop sizes, and the
 * repositioning row. Art constants (sprite crops, label sizes) live in
 * `components/battle/constants.ts`.
 */

import { TROOP_ART } from './troops';

/** Distance of each side's formation from the vertex center (world units). */
export const SIDE_OFFSET = 130;
/** Rolled troops stop this far inside the center clash line while rolling. */
export const CENTER_GAP = 15;
/** Distance from the clash line where a pair fights its duel (and where the
 *  front line stands once the round resolves — the armies line up at the
 *  animation's spots so the replay starts with no shuffle). */
export const FIGHT_GAP = 30;
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
/** Injured-soldier icon in the repositioning view: the board's injured art box
 *  (same canvas as the healthy soldier). */
export const REPOSITION_SOLDIER_W = TROOP_ART.injured.w;
export const REPOSITION_SOLDIER_H = TROOP_ART.injured.h;
