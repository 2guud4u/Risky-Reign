import React from 'react';
import { Board, VertexNode } from 'common';

/**
 * Settlement/city marker at a vertex: a square for a settlement, a triangle
 * for a city, both in the owner's color. Renders nothing when the vertex is
 * unoccupied.
 */
export const SettlementMarker: React.FC<{
  vertex: VertexNode;
  /** Vertex marker radius the building glyph is sized from. */
  r: number;
  board: Board;
  playerColors?: Record<string, string>;
}> = ({ vertex: v, r, board, playerColors }) => {
  const settlement = v.settlementId ? board.settlements[v.settlementId] : null;
  if (!settlement) return null;
  const color = playerColors?.[settlement.ownerId] ?? '#8B4513';
  if (settlement.level === 'city') {
    const s = r * 1.8;
    const cx = v.position.x;
    const cy = v.position.y;
    return (
      <polygon
        points={`${cx},${cy - s / 2} ${cx - s / 2},${cy + s / 2} ${cx + s / 2},${cy + s / 2}`}
        fill={color}
        stroke="#333"
        strokeWidth={1.5}
      />
    );
  }
  const s = r * 1.8;
  return (
    <rect
      x={v.position.x - s / 2}
      y={v.position.y - s / 2}
      width={s}
      height={s}
      fill={color}
      stroke="#fff"
      strokeWidth={2}
    />
  );
};
