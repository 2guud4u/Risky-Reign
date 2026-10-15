import React from 'react';
import { Price, RESOURCES } from 'common';
import { RESOURCE_ICONS } from './resourceIcons';
import GameIcon from '../components/ui/GameIcon';

/** Plain-text price ("2 wheat, 3 ore") for strings — aria labels, titles. */
export const priceLabel = (p: Price): string => {
  const parts = RESOURCES.filter((k) => p[k] > 0).map((k) => `${p[k]} ${k}`);
  return parts.length ? parts.join(', ') : 'nothing';
};

/**
 * The price as inline icons + counts ("2 🌾, 3 🪨" — but real icons), for
 * JSX surfaces like bubble cost text and recipe lines.
 */
export const PriceText: React.FC<{ price: Price; size?: number }> = ({ price, size = 14 }) => {
  const parts = RESOURCES.filter((k) => price[k] > 0);
  if (!parts.length) return <>nothing</>;
  return (
    <>
      {parts.map((k, i) => (
        <React.Fragment key={k}>
          {i > 0 && ', '}
          {price[k]} <GameIcon name={RESOURCE_ICONS[k]} size={size} className="inline -mt-0.5" />
        </React.Fragment>
      ))}
    </>
  );
};
