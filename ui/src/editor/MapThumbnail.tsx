import React, { useMemo } from 'react';
import { HexLayout, cubeToPixel, terrainColors } from 'common';

const SIZE = 10;

/**
 * A mini hex-grid preview of a catalog map: every hex as a small polygon in
 * its terrain color. Pure render of the layout — no interactions.
 */
const MapThumbnail: React.FC<{ layouts: HexLayout[] }> = ({ layouts }) => {
  const { polys, viewBox } = useMemo(() => {
    const pts = layouts.map((l) => cubeToPixel(l.coord, SIZE));
    const minX = Math.min(...pts.map((p) => p.x)) - SIZE;
    const minY = Math.min(...pts.map((p) => p.y)) - SIZE;
    const w = Math.max(...pts.map((p) => p.x)) - minX + SIZE;
    const h = Math.max(...pts.map((p) => p.y)) - minY + SIZE;
    return {
      viewBox: `0 0 ${w} ${h}`,
      polys: layouts.map((l, i) => {
        const cx = pts[i].x - minX;
        const cy = pts[i].y - minY;
        const corners = Array.from({ length: 6 }, (_, k) => {
          const a = (Math.PI / 180) * (60 * k - 30);
          return `${(cx + SIZE * Math.cos(a)).toFixed(1)},${(cy + SIZE * Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        return { corners, fill: terrainColors[l.terrain] ?? '#ccc' };
      }),
    };
  }, [layouts]);

  return (
    <svg viewBox={viewBox} className="w-full h-auto block">
      {polys.map((p, i) => (
        <polygon key={i} points={p.corners} fill={p.fill} />
      ))}
    </svg>
  );
};

export default MapThumbnail;
