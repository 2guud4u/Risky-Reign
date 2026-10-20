/**
 * Transient-UI timings: error toasts, the giant dice linger, and the
 * resource gain/spend card-flight animations.
 */

/** How long (ms) a transient error toast stays visible before auto-dismissing. */
export const TOAST_DURATION_MS = 4000;
/** How long (ms) the giant dice stay up after the second die lands. */
export const DICE_RESULT_LINGER_MS = 2000;

/** ms for the settlement pop-in. */
export const BUILD_SETTLE_MS = 450;
/** ms for the road grow-in along its edge. */
export const BUILD_ROAD_MS = 350;
/** ms of smoke before the new city pops (city upgrade total ≈ +POP). */
export const BUILD_CITY_REVEAL_MS = 560;
/** ms for the city pop-in itself (starts after BUILD_CITY_REVEAL_MS). */
export const BUILD_CITY_POP_MS = 320;
/** ms per smoke puff; each puff also carries a small stagger delay. */
export const BUILD_PUFF_MS = 620;

/** ms per card flight. */
export const GAIN_DURATION = 5000;
/** ms offset between successive cards. */
export const GAIN_STAGGER = 1100;
/** ms per card flight for the spend (build) animation. */
export const SPEND_DURATION = 5000;
/** ms offset between successive cards for the spend animation. */
export const SPEND_STAGGER = 1100;
