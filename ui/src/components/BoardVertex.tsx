import React from 'react';
import { BoardVertex as BoardVertexType } from 'common';
import { VERTEX_HIT_SCALE } from '../constants';
import { TintedSprite } from './TintedSprite';
import { CITY_ART, SETTLEMENT_ART } from '../utils/tintedArt';
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
  
  // Piece art sizing, in multiples of the vertex dot size. The art is cropped
  // to the visible piece and the sprite is contained in the box (aspect kept),
  // so the center offset positions it slightly above the vertex. The numbers
  // match the pre-crop board look; the village (settlement) is larger than a
  // single house but clearly smaller than a city.
  const isCity = settlementLevel === 'city';
  const houseW = size * (isCity ? 12.9 : 8.0);
  const houseH = size * (isCity ? 13.61 : 8.14);
  const houseCx = position.x + size * (isCity ? 0.31 : 0);
  const houseCy = position.y - size * (isCity ? 2.41 : 2.5);
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
          owner's color. */}
      {hasSettlement && !isCity && (
        <TintedSprite
          art={SETTLEMENT_ART}
          color={ownerColor ?? '#999'}
          x={houseCx - houseW / 2}
          y={houseCy - houseH / 2}
          width={houseW}
          height={houseH}
        />
      )}
      {/* City: pre-baked raster; the roof is tinted to the owner's color. */}
      {hasSettlement && isCity && (
        <TintedSprite
          art={CITY_ART}
          color={ownerColor ?? '#999'}
          x={houseCx - houseW / 2}
          y={houseCy - houseH / 2}
          width={houseW}
          height={houseH}
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
