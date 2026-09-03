import React from 'react';
import { BoardVertex as BoardVertexType, PortType, PixelCoord } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

interface BoardVertexProps extends BoardVertexType {
  onClick: (vertexId: string) => void;
  onHover: (vertexId: string | null) => void;
  size?: number;
  /** Owner's chosen color, used to tint the settlement. */
  ownerColor?: string;
}

// Port (harbor) presentation constants — all sized relative to the vertex `size`.
const PORT_OFFSET = 5; // how far past the vertex the badge sits (into the water)
const PORT_RADIUS = 2.2; // badge radius
const PORT_INNER = 0.72; // inner "water" circle, as a fraction of the badge radius
const PORT_TEXT = 1.7; // glyph font size
const PORT_GENERIC_FILL = '#7a4a1f';
const PORT_SPECIAL_FILL = '#3f7fb5';
const PORT_STROKE = '#1e2a38';
const PORT_WATER = '#cfe8f7';

/**
 * A trade port (harbor) marker. Positioned radially outward from the board
 * center so it sits on the coast (in the water), never on top of a hex.
 */
const PortIcon: React.FC<{ position: PixelCoord; port: PortType; size: number }> = ({
  position,
  port,
  size,
}) => {
  const dist = Math.hypot(position.x, position.y);
  const offset = size * PORT_OFFSET;
  const x = dist > 0 ? position.x + (position.x / dist) * offset : position.x;
  const y = dist > 0 ? position.y + (position.y / dist) * offset : position.y;
  const isGeneric = port === 'generic';
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={size * PORT_RADIUS}
        fill={isGeneric ? PORT_GENERIC_FILL : PORT_SPECIAL_FILL}
        stroke={PORT_STROKE}
        strokeWidth={1.5}
        opacity={0.97}
      />
      <circle cx={x} cy={y} r={size * PORT_RADIUS * PORT_INNER} fill={PORT_WATER} opacity={0.9} />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * PORT_TEXT}
      >
        {isGeneric ? '⛵' : RESOURCE_ICONS[port as keyof typeof RESOURCE_ICONS]}
      </text>
    </g>
  );
};

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
      {/* Port icon (harbor) — rendered on the coast, never on a hex. */}
      {port && <PortIcon position={position} port={port} size={size} />}

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
