import React from 'react';
import { TintArt, useTintedArt } from '../utils/tintedArt';

/**
 * A player-colored raster piece inside an SVG: one <image> of the art
 * pre-baked with `color` (see utils/tintedArt). Fitted into its box like the
 * old `<use>` of a symbol (aspect kept, centered). Draws nothing until the
 * bake for a new color settles, normally within the first frame.
 */
export const TintedSprite: React.FC<{
  art: TintArt;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  transform?: string;
}> = ({ art, color, x, y, width, height, transform }) => {
  const href = useTintedArt(art, color);
  if (!href) return null;
  return (
    <image
      href={href}
      x={x}
      y={y}
      width={width}
      height={height}
      transform={transform}
      pointerEvents="visiblePainted"
    />
  );
};

/** The same baked art as an HTML <img> (modals, lobby previews). */
export const TintedImg: React.FC<{
  art: TintArt;
  color: string;
  width: number;
  height: number;
  className?: string;
}> = ({ art, color, width, height, className }) => {
  const src = useTintedArt(art, color);
  // Keep the box while the bake settles so the layout doesn't jump.
  if (!src) return <span style={{ display: 'inline-block', width, height }} aria-hidden />;
  return (
    <img
      src={src}
      width={width}
      height={height}
      alt=""
      aria-hidden
      className={className}
      style={{ objectFit: 'contain' }}
      draggable={false}
    />
  );
};
