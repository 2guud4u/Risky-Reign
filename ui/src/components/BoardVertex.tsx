import React from 'react';
import { BoardVertex as BoardVertexType } from 'common';
import { darkenColor } from '../utils/color';

interface BoardVertexProps extends BoardVertexType {
  onClick: (vertexId: string) => void;
  onHover: (vertexId: string | null) => void;
  size?: number;
  /** Owner's chosen color, used to tint the settlement. */
  ownerColor?: string;
}

const BoardVertexInner: React.FC<BoardVertexProps> = ({
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
  
  // House art sizing; cities render at a different size than settlements
  // (larger, with a different aspect ratio — not just a uniform scale).
  const houseW = settlementLevel === 'city' ? size * 16.875 : size * 7.5;
  const houseH = settlementLevel === 'city' ? size * 17.8125 : size * 8.8125;

  // Move the house slightly above the vertex center.
  const yOffset = settlementLevel === 'city' ? size * .5 : size * 1.5;



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

      {/* Settlement: multi-color house art; the medium-gray layer is the
          owner's color (via currentColor). */}
      {hasSettlement && (
        <svg
          x={position.x - houseW / 2}
          y={position.y - houseH / 2 - yOffset}
          width={houseW}
          height={houseH}
          shapeRendering="optimizeSpeed"
          style={{
            color: ownerColor ?? '#999',
            // Darker tone for the shadow layer; falls back to the SVG's #6b6c68
            // when there is no owner color.
            ['--settlement-dark' as string]: ownerColor ? darkenColor(ownerColor) : undefined,
          }}
        >
          <use
            href={settlementLevel === 'city' ? '/art/city.svg#city-shape' : '/art/settlement.svg#settlement-shape'}
            width={houseW}
            height={houseH}
          />
        </svg>
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
export const BoardVertex = React.memo(BoardVertexInner);
