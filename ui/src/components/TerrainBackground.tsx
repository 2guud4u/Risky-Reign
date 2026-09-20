import React from 'react';
import { terrainColors } from 'common';

/**
 * Terrain → background artwork (served from /public/art). Each SVG is a
 * self-contained 1080×1080 doc whose embedded image is already clipped to a
 * regular pointy-top hexagon (R = 518.4 in that space), so it can be placed
 * directly as the hex background.
 */
const terrainArt: Record<string, string> = {
  Wood: '/art/forest.svg',
  Sheep: '/art/pasture.svg',
  Wheat: '/art/field.svg',
  Brick: '/art/brick.svg',
  Ore: '/art/ore.svg',
  Desert: '/art/desert.svg',
};

/** The SVG's hexagon radius, in its 1080×1080 coordinate space. */
const ART_HEX_RADIUS = 518.4;
/** The SVG's hexagon center, in its 1080×1080 coordinate space. */
const ART_CENTER = 540;
/** The SVG's full square side, in its 1080×1080 coordinate space. */
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
