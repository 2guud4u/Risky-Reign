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
  
  // House art sizing, in multiples of the vertex dot size. The art's viewBox
  // is cropped to the visible piece, so width/height match the drawn house
  // and the center offset positions it slightly above the vertex. The numbers
  // reproduce the board's look from before the art was cropped.
  const isCity = settlementLevel === 'city';
  const houseW = size * (isCity ? 12.9 : 5.85);
  const houseH = size * (isCity ? 13.61 : 5.99);
  const houseCx = position.x + size * (isCity ? 0.31 : 0.04);
  const houseCy = position.y - size * (isCity ? 2.41 : 1.15);
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
          x={houseCx - houseW / 2}
          y={houseCy - houseH / 2}
          width={houseW}
          height={houseH}
          style={{
            color: ownerColor ?? '#999',
            // Darker tone for the shadow layer; falls back to the SVG's #6b6c68
            // when there is no owner color.
            ['--settlement-dark' as string]: ownerColor ? darkenColor(ownerColor) : undefined,
          }}
        >
          <use
            href={isCity ? '/art/city.svg#city-shape' : '/art/settlement.svg#settlement-shape'}
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
