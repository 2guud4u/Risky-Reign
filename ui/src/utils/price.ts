import { Price, RESOURCES } from 'common';

/** Compact one-line summary of a price like "2 Wheat, 3 Ore". */
export const priceLabel = (p: Price): string => {
  const parts = RESOURCES.filter((k) => p[k] > 0).map((k) => `${p[k]} ${k}`);
  return parts.length ? parts.join(', ') : 'nothing';
};
