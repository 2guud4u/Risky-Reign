import React from 'react';
import { BoardEdge as BoardEdgeType } from 'common';
import { ROAD_HIT_WIDTH } from '../constants';
import { usePieceHidden } from './board/buildFx';
import { TintedSprite } from './TintedSprite';
import { ROAD_ART, ROAD_SPRITE_W, ROAD_SPRITE_H } from '../utils/tintedArt';
import { C } from '../theme';

interface BoardEdgeProps extends BoardEdgeType {
  onClick: (edgeId: string) => void;
  onHover: (edgeId: string | null) => void;
  ownerColor?: string;
  /** The road is a wall (gates enemy crossings). */
  isWall?: boolean;
};

const BoardEdgeInner: React.FC<BoardEdgeProps> = ({
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
  isWall,
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

  // Hidden while a build animation stands in for the road (buildFx).
  const pieceHidden = usePieceHidden(id);
  const roadDrawn = hasRoad && !pieceHidden;
  const getStrokeColor = () => {
    if (isHovered) return C['board.hover'];
    if (roadDrawn) return ownerColor ?? C['board.wood'];
    if (!isSelectable) return C['board.ghost'];
    return C['board.line'];
  };

  const getStrokeWidth = () => {
    if (roadDrawn) return isWall ? 10 : 8;
    return 4;
  };

  /*
   * Calculate a perpendicular unit vector to the road.
   *
   * Road direction:
   *   dx = end.x - start.x
   *   dy = end.y - start.y
   *
   * Perpendicular:
   *   (-dy, dx)
   */
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  const nx = length > 0 ? -dy / length : 0;
  const ny = length > 0 ? dx / length : 0;

  // Distance from the center of the road.
  const roadWidth = getStrokeWidth();

  // Put the dots just outside the road.
  const offset = roadWidth / 2 + 3;

  const offsetX = nx * offset;
  const offsetY = ny * offset;

  return (
    <g
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        cursor: isSelectable ? 'pointer' : 'default',
      }}
    >
      {/* Wide transparent hit-line: lets selection/hover target the road
       * well beyond its thin visible stroke. */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="transparent"
        strokeWidth={ROAD_HIT_WIDTH}
        strokeLinecap="round"
      />
      {/* Road: owner-tinted cobblestone sprite laid along the edge. Walled
          roads show it too — the wall sprite (StructureLayer) sits on top,
          a wall standing on the road. */}
      {roadDrawn ? (
        <g opacity={isSelectable ? 1 : 0.5}>
          <TintedSprite
            art={ROAD_ART}
            color={ownerColor ?? C['board.wood']}
            x={-ROAD_SPRITE_W / 2}
            y={-ROAD_SPRITE_H / 2}
            width={ROAD_SPRITE_W}
            height={ROAD_SPRITE_H}
            transform={`translate(${(start.x + end.x) / 2},${(start.y + end.y) / 2}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}) scale(${(length + 10) / ROAD_SPRITE_W})`}
            pointerEvents="none"
          />
        </g>
      ) : (
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
      )}
      {/* Red dotted selection outline */}
      {isSelected && (
        <>
          {/* Top/first side */}
<line
  x1={start.x + offsetX}
  y1={start.y + offsetY}
  x2={end.x + offsetX}
  y2={end.y + offsetY}
  stroke={C['board.danger']}
  strokeWidth={2}
  strokeLinecap="round"
  strokeDasharray="2 6"
  className="blink-road"
  pointerEvents="none"
/>

{/* Bottom/second side - opposite direction */}
<line
  x1={start.x - offsetX}
  y1={start.y - offsetY}
  x2={end.x - offsetX}
  y2={end.y - offsetY}
  stroke={C['board.danger']}
  strokeWidth={2}
  strokeLinecap="round"
  strokeDasharray="2 6"
  className="blink-road-reverse"
  pointerEvents="none"
/>
        </>
      )}

    </g>
  );
};
export const BoardEdge = React.memo(BoardEdgeInner);