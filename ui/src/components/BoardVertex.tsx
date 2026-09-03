import React from 'react';
import { BoardVertex as BoardVertexType } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

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
  port,
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
      {/* Port icon — sits on the coast (radially outward from the board
          center, in the water) so it never overlaps a hex. Styled like a
          Catan harbor: a round badge floating in the sea with a ship or
          resource glyph. */}
      {port &&
        (() => {
          const dist = Math.hypot(position.x, position.y);
          const dirX = dist > 0 ? position.x / dist : 0;
          const dirY = dist > 0 ? position.y / dist : 0;
          // Push the badge out into the water, past the hex edge.
          const offset = size * 5;
          const portX = position.x + dirX * offset;
          const portY = position.y + dirY * offset;
          const r = size * 2.2;
          return (
            <g>
              <circle
                cx={portX}
                cy={portY}
                r={r}
                fill={port === 'generic' ? '#7a4a1f' : '#3f7fb5'}
                stroke="#1e2a38"
                strokeWidth={1.5}
                opacity={0.97}
              />
              <circle
                cx={portX}
                cy={portY}
                r={r * 0.72}
                fill="#cfe8f7"
                opacity={0.9}
              />
              <text
                x={portX}
                y={portY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={size * 1.7}
              >
                {port === 'generic' ? '⛵' : RESOURCE_ICONS[port as keyof typeof RESOURCE_ICONS]}
              </text>
            </g>
          );
        })()}

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
