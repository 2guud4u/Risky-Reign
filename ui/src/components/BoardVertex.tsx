import React from 'react';
import { BoardVertex as BoardVertexType, PortType, PixelCoord } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import {
  PORT_GENERIC_FILL,
  PORT_OFFSET,
  PORT_PIER,
  PORT_PIER_EDGE,
  PORT_RADIUS,
  PORT_SPECIAL_FILL,
  PORT_STROKE,
  PORT_TEXT,
} from '../constants';

interface BoardVertexProps extends BoardVertexType {
  onClick: (vertexId: string) => void;
  onHover: (vertexId: string | null) => void;
  size?: number;
  /** Owner's chosen color, used to tint the settlement. */
  ownerColor?: string;
}

/**
 * A trade port (harbor) marker. A dock serves 1 or 2 adjacent coastal
 * vertices. For a single-vertex dock the icon sits on the coast at that
 * vertex; for a two-vertex dock a single icon sits at the midpoint and a
 * little road is drawn from the port to each of the two vertices it
 * serves. Positioned radially outward from the board center so it sits in
 * the water, never on top of a hex.
 */
export const PortDock: React.FC<{
  vertices: PixelCoord[];
  port: PortType;
  size: number;
}> = ({ vertices, port, size }) => {
  const anchor =
    vertices.length === 1
      ? vertices[0]
      : { x: (vertices[0].x + vertices[1].x) / 2, y: (vertices[0].y + vertices[1].y) / 2 };
  const dist = Math.hypot(anchor.x, anchor.y);
  const offset = size * PORT_OFFSET;
  const x = dist > 0 ? anchor.x + (anchor.x / dist) * offset : anchor.x;
  const y = dist > 0 ? anchor.y + (anchor.y / dist) * offset : anchor.y;
  const isGeneric = port === 'generic';
  const r = size * PORT_RADIUS;
  return (
    <g>
      {/* Piers: a little wooden dock from the harbor to each vertex it serves. */}
      {vertices.length === 2 &&
        vertices.map((v, i) => (
          <g key={i}>
            <line x1={x} y1={y} x2={v.x} y2={v.y} stroke={PORT_PIER_EDGE} strokeWidth={size * 0.7} strokeLinecap="round" />
            <line x1={x} y1={y} x2={v.x} y2={v.y} stroke={PORT_PIER} strokeWidth={size * 0.45} strokeLinecap="round" />
          </g>
        ))}
      {/* Dock badge: white ring for contrast, soft fill, top highlight, glyph. */}
      {/* <circle cx={x} cy={y} r={r + size * PORT_RING} fill="#ffffff" opacity={0.92} /> */}
      <circle cx={x} cy={y} r={r} fill={isGeneric ? PORT_GENERIC_FILL : PORT_SPECIAL_FILL} stroke={PORT_STROKE} strokeWidth={1} />
      <ellipse cx={x} cy={y - r * 0.45} rx={r * 0.55} ry={r * 0.32} fill="#ffffff" opacity={0.22} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size * PORT_TEXT}>
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
