import React from 'react';
import { BoardVertex as BoardVertexType } from 'common';

interface BoardVertexProps extends BoardVertexType {
  onClick: (vertexId: string) => void;
  onHover: (vertexId: string | null) => void;
  size?: number;
  /** Owner's chosen color, used to tint the settlement. */
  ownerColor?: string;
}

export const BoardVertex: React.FC<BoardVertexProps> = ({
  id,
  position,
  hasSettlement,
  settlementLevel,
  isHovered,
  isSelected,
  isSelectable,
  onClick,
  onHover,
  size = 8,
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

  const getColor = () => {
    if (isSelected) return '#FFD700';
    if (isHovered) return '#FFA500';
    if (!isSelectable) return '#666';
    return '#999';
  };

  const getSettlementColor = () => {
    if (ownerColor) return ownerColor;
    switch (settlementLevel) {
      case 'city':
        return '#FFD700';
      case 'settlement':
        return '#A0522D';
      default:
        return 'transparent';
    }
  };

  return (
    <g
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isSelectable ? 'pointer' : 'default' }}
    >
      {/* Vertex dot */}
      <circle
        cx={position.x}
        cy={position.y}
        r={size}
        fill={getColor()}
        stroke="#333"
        strokeWidth={2}
        opacity={isSelectable ? 1 : 0.5}
      />

      {/* Settlement indicator */}
      {hasSettlement && (
        <g>
          <rect
            x={position.x - size * 2}
            y={position.y - size * 2}
            width={size * 4}
            height={size * 4}
            fill={getSettlementColor()}
            stroke="#333"
            strokeWidth={1}
          />
          <text
            x={position.x}
            y={position.y + 4}
            textAnchor="middle"
            fill="white"
            fontSize={size}
            fontWeight="bold"
          >
            {settlementLevel === 'city' ? 'C' : 'S'}
          </text>
        </g>
      )}

      {/* Selection ring */}
      {isSelected && (
        <circle
          cx={position.x}
          cy={position.y}
          r={size * 2.5}
          fill="none"
          stroke="#eb1010"
          strokeWidth={3}
          strokeDasharray="5,5"
          className="blink-circle"
        />
      )}
    </g>
  );
};
