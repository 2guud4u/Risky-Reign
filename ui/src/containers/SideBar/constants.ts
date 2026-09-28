/**
 * Presentation constants for the sidebar panels (colors and fixed labels).
 */

/** Fallback dot color when a settlement owner's player color is missing. */
export const UNKNOWN_OWNER_COLOR = '#999';

/** Text color for the owner name on adjacent-edge rows. */
export const SETTLEMENT_OWNER_COLOR = '#8B4513';

/** Human-readable heal cost shown on heal buttons. */
export const HEAL_COST_LABEL = '1 Wheat or 1 Sheep';
/** The two resources a heal can be paid with. */
export const HEAL_PAY_OPTIONS: ReadonlyArray<'Wheat' | 'Sheep'> = ['Wheat', 'Sheep'];
