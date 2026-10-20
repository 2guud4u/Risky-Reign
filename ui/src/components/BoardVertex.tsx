import React from 'react';
import { BoardVertex as BoardVertexType } from 'common';
import { VERTEX_HIT_SCALE } from '../constants';
import { TintedSprite } from './TintedSprite';
import { CITY_ART, SETTLEMENT_ART } from '../utils/tintedArt';
import { houseFrame } from '../utils/boardPresentation';
import { usePieceHidden } from './board/buildFx';
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
  
  // Hidden while a build animation stands in for the piece (buildFx).
  const pieceHidden = usePieceHidden(id);
  const isCity = settlementLevel === 'city';
  const frame = houseFrame(isCity, position, size);
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
        stroke="#333"
        strokeWidth={2}
        opacity={isSelectable ? 1 : 0.5}
      />

      {/* Settlement: whole-village art; the thatched roofs are tinted to the
          owner's color. Hidden while the build animation stands in. */}
      {hasSettlement && !isCity && !pieceHidden && (
        <TintedSprite
          art={SETTLEMENT_ART}
          color={ownerColor ?? '#999'}
          x={frame.x}
          y={frame.y}
          width={frame.w}
          height={frame.h}
        />
      )}
      {/* City: pre-baked raster; the roof is tinted to the owner's color. */}
      {hasSettlement && isCity && !pieceHidden && (
        <TintedSprite
          art={CITY_ART}
          color={ownerColor ?? '#999'}
          x={frame.x}
          y={frame.y}
          width={frame.w}
          height={frame.h}
        />
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
