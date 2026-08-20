import React from 'react';
import { BoardEdge as BoardEdgeType } from 'common';

interface BoardEdgeProps extends BoardEdgeType {
  onClick: (edgeId: string) => void;
  onHover: (edgeId: string | null) => void;
  /** Owner's chosen color, used to tint the road. */
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
    if (isSelected) return '#FFD700';
    if (isHovered) return '#FFA500';
    if (hasRoad) return ownerColor ?? '#8B4513';
    if (!isSelectable) return '#999';
    return '#383636';
  };

  const getStrokeWidth = () => {
    if (hasRoad) return 8;
    return 4;
  };

  return (
    <g
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isSelectable ? 'pointer' : 'default' }}
    >
      {/* Edge line */}
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

      {/* Selection highlight */}
      {isSelected && (
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#eb1010"
          strokeWidth={getStrokeWidth() + 4}
          strokeLinecap="round"
          opacity={0.3}
          className="blink-road"
        />
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
        >
          🛤️
        </text>
      )}
    </g>
  );
};
