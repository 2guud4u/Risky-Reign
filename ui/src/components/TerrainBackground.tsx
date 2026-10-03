import React from 'react';
import { terrainColors } from 'common';

/**
 * Terrain → background artwork (served from /public/art). Each image is a
 * square WebP whose hexagon is already cut out (transparent outside), with the
 * same geometry as the original 1080×1080 artwork, downscaled to 720 px (about
 * the largest a hex is drawn at max zoom). A plain raster is far cheaper to
 * draw than the old SVG wrappers (embedded 1080 px PNG + clip-path), which
 * made pan/zoom lag.
 */
const terrainArt: Record<string, string> = {
  Wood: '/art/forest.webp',
  Sheep: '/art/pasture.webp',
  Wheat: '/art/field.webp',
  Brick: '/art/brick.webp',
  Ore: '/art/ore.webp',
  Desert: '/art/desert.webp',
  Water: '/art/water.webp',
};

/** The artwork's hexagon radius, in the original 1080×1080 artwork space. */
const ART_HEX_RADIUS = 518.4;
/** The artwork's hexagon center, in the original 1080×1080 artwork space. */
const ART_CENTER = 540;
/** The artwork's full square side, in the original 1080×1080 artwork space. */
const ART_SIDE = 1080;

interface TerrainBackgroundProps {
  /** Hex center x. */
  x: number;
  /** Hex center y. */
  y: number;
  /** Hex radius (center to vertex). */
  size: number;
  /** Terrain name (keys the artwork map). */
  terrain: string;
  /** The hex polygon `points` (used for the flat-color fallback). */
  points: string;
}

/**
 * Renders a hex's terrain background: the artwork (a self-contained SVG whose
 * embedded image is already clipped to a regular pointy-top hexagon), placed
 * so its hexagon aligns with this hex. Falls back to a flat color when the
 * terrain has no artwork. The caller renders its own border on top.
 */
const TerrainBackground: React.FC<TerrainBackgroundProps> = ({ x, y, size, terrain, points }) => {
  const art = terrainArt[terrain];
  if (art) {
    const s = size / ART_HEX_RADIUS;
    return (
      <image
        href={art}
        x={x - ART_CENTER * s}
        y={y - ART_CENTER * s}
        width={ART_SIDE * s}
        height={ART_SIDE * s}
      />
    );
  }
  return <polygon points={points} fill={terrainColors[terrain] ?? '#DDD'} />;
};

export default TerrainBackground;
