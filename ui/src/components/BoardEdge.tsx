import React from 'react';
import { BoardEdge as BoardEdgeType } from 'common';

interface BoardEdgeProps extends BoardEdgeType {
  onClick: (edgeId: string) => void;
  onHover: (edgeId: string | null) => void;
  ownerColor?: string;
}

export const BoardEdge: React.FC<BoardEdgeProps> = ({
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
    if (hasRoad) return 8;
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

      {/* Road indicator */}
      {hasRoad && (
        <text
          x={(start.x + end.x) / 2}
          y={(start.y + end.y) / 2}
          textAnchor="middle"
          fill="#8B4513"
          fontSize="12"
          fontWeight="bold"
          pointerEvents="none"
        >
          🛤️
        </text>
      )}
    </g>
  );
};