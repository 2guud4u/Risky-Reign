import { Price, RESOURCES } from 'common';
import { RESOURCE_ICONS } from './resourceIcons';

/** Compact one-line summary of a price like "2 🌾, 3 ⛏️". */
export const priceLabel = (p: Price): string => {
  const parts = RESOURCES.filter((k) => p[k] > 0).map((k) => `${p[k]} ${RESOURCE_ICONS[k]}`);
  return parts.length ? parts.join(', ') : 'nothing';
};
