import React from 'react';
import { BoardEdge as BoardEdgeType } from 'common';
import { ROAD_HIT_WIDTH } from '../constants';

interface BoardEdgeProps extends BoardEdgeType {
  onClick: (edgeId: string) => void;
  onHover: (edgeId: string | null) => void;
  ownerColor?: string;
  /** The road is a wall (gates enemy crossings). */
  isWall?: boolean;
};

const BoardEdgeInner: React.FC<BoardEdgeProps> = ({
  id,
  start,
  end,
  hasRoad,
  isHovered,
  isSelected,
  isSelectable,
  onClick,
  onHover,
  ownerColor,
  isWall,
}) => {
  const handleClick = () => {
    if (isSelectable) {
      onClick(id);
    }
  };

  const handleMouseEnter = () => {
    if (isSelectable) {
      onHover(id);
    }
  };

  const handleMouseLeave = () => {
    onHover(null);
  };

  const getStrokeColor = () => {
    if (isHovered) return '#FFA500';
    if (hasRoad) return ownerColor ?? '#8B4513';
    if (!isSelectable) return '#999';
    return '#383636';
  };

  const getStrokeWidth = () => {
    if (hasRoad) return isWall ? 10 : 8;
    return 4;
  };

  /*
   * Calculate a perpendicular unit vector to the road.
   *
   * Road direction:
   *   dx = end.x - start.x
   *   dy = end.y - start.y
   *
   * Perpendicular:
   *   (-dy, dx)
   */
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  const nx = length > 0 ? -dy / length : 0;
  const ny = length > 0 ? dx / length : 0;

  // Distance from the center of the road.
  const roadWidth = getStrokeWidth();

  // Put the dots just outside the road.
  const offset = roadWidth / 2 + 3;

  const offsetX = nx * offset;
  const offsetY = ny * offset;

  return (
    <g
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        cursor: isSelectable ? 'pointer' : 'default',
      }}
    >
      {/* Wide transparent hit-line: lets selection/hover target the road
       * well beyond its thin visible stroke. */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="transparent"
        strokeWidth={ROAD_HIT_WIDTH}
        strokeLinecap="round"
      />
      {/* Normal road */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={getStrokeColor()}
        strokeWidth={getStrokeWidth()}
        strokeLinecap="round"
        opacity={isSelectable ? 1 : 0.5}
      />
      {/* Wall: the extracted fortress sprite, rotated to sit perpendicular
          across the road. Three baked orientations cover the hex edges;
          we pick the nearest and rotate the small remainder. */}
      {hasRoad && isWall && length > 0 && (() => {
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        // Wall sprites were captured perpendicular to their edge in the
        // source hex (edges at ~30/90/150 degrees); bucket to the closest.
        const buckets = [30, 90, 150];
        const norm = ((angleDeg % 180) + 180) % 180; // [0,180)
        const bucket = buckets.reduce((a, b) =>
          Math.min(Math.abs(norm - a), 180 - Math.abs(norm - a)) <=
          Math.min(Math.abs(norm - b), 180 - Math.abs(norm - b))
            ? a
            : b,
        );
        const sprite = { 30: '/art/pieces/wall_30.png', 90: '/art/pieces/wall_90.png', 150: '/art/pieces/wall_150.png' }[bucket];
        // Sprite is stored horizontal; rotate to perpendicular to the road.
        const rotate = angleDeg + 90;
        const w = length * 0.72;
        const h = w * 0.3;
        const mx = (start.x + end.x) / 2;
        const my = (start.y + end.y) / 2;
        return (
          <image
            href={sprite}
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            transform={`translate(${mx},${my}) rotate(${rotate})`}
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          />
        );
      })()}

      {/* Red dotted selection outline */}
      {isSelected && (
        <>
          {/* Top/first side */}
<line
  x1={start.x + offsetX}
  y1={start.y + offsetY}
  x2={end.x + offsetX}
  y2={end.y + offsetY}
  stroke="#eb1010"
  strokeWidth={2}
  strokeLinecap="round"
  strokeDasharray="2 6"
  className="blink-road"
  pointerEvents="none"
/>

{/* Bottom/second side - opposite direction */}
<line
  x1={start.x - offsetX}
  y1={start.y - offsetY}
  x2={end.x - offsetX}
  y2={end.y - offsetY}
  stroke="#eb1010"
  strokeWidth={2}
  strokeLinecap="round"
  strokeDasharray="2 6"
  className="blink-road-reverse"
  pointerEvents="none"
/>
        </>
      )}

    </g>
  );
};
export const BoardEdge = React.memo(BoardEdgeInner);