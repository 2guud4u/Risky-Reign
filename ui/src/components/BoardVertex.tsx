import React from 'react';
import { BoardVertex as BoardVertexType } from 'common';
import { VERTEX_HIT_SCALE } from '../constants';
import { C } from '../theme';
interface BoardVertexProps extends BoardVertexType {
  onClick: (vertexId: string) => void;
  onHover: (vertexId: string | null) => void;
  size?: number;
}

/**
 * A vertex's hit area, dot and (when empty) selection ring. Settlement and
 * city art draws in StructureLayer, depth-sorted with walls.
 */
const BoardVertexInner: React.FC<BoardVertexProps> = ({
  id,
  position,
  hasSettlement,
  isHovered,
  isSelected,
  isSelectable,
  onClick,
  onHover,
  size = 8,
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
    if (isSelected) return C['board.select'];
    if (isHovered) return C['board.hover'];
    if (!isSelectable) return C['board.dim'];
    return C['board.ghost'];
  };
  
  return (
    <g
      data-vertex-id={id}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isSelectable ? 'pointer' : 'default' }}
    >
      {/* Fattened invisible hit ring: fingertip-sized taps land on the
          vertex even at board-fit zoom. */}
      <circle cx={position.x} cy={position.y} r={size * VERTEX_HIT_SCALE} fill="transparent" />
      {/* Vertex dot */}
      <circle
        cx={position.x}
        cy={position.y}
        r={size}
        fill={getColor()}
        stroke={C['board.markerEdge']}
        strokeWidth={2}
        opacity={isSelectable ? 1 : 0.5}
      />
      {/* Selection ring (a town draws its own, above its art). */}
      {isSelected && !hasSettlement && (
        <circle
          cx={position.x}
          cy={position.y}
          r={size * 2.5}
          fill="none"
          stroke={C['board.danger']}
          strokeWidth={3}
          strokeDasharray="5,5"
          className="blink-circle"
        />
      )}
    </g>
  );
};
export const BoardVertex = React.memo(BoardVertexInner);
