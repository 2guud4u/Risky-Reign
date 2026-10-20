import React from 'react';
import { BOARD_VERTEX_SIZE, WALL_LENGTH_FRACTION } from '../../constants';
import { BoardEdgeRender, BoardVertexRender } from '../../types/board';
import { houseFrame } from '../../utils/boardPresentation';
import { CITY_ART, SETTLEMENT_ART, WALL_REFERENCE_LENGTH_PX, WALL_SPRITES } from '../../utils/tintedArt';
import { TintedSprite } from '../TintedSprite';
import { usePieceHidden } from './buildFx';

/** Signed difference a − b folded into (−90, 90]: walls are symmetric
 *  under a half turn, so only the line's direction matters. */
const lineDelta = (a: number, b: number) => {
  const d = (((a - b) % 180) + 180) % 180;
  return d > 90 ? d - 180 : d;
};

/**
 * One wall: the owner-tinted sprite whose drawn axis is closest to
 * perpendicular to the road, rotated only by the remainder (a few degrees)
 * so its perspective and lighting stay as drawn. Never catches input.
 */
const Wall: React.FC<{ edge: BoardEdgeRender }> = ({ edge }) => {
  const hidden = usePieceHidden(edge.id);
  const { start, end } = edge;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (hidden || length === 0) return null;
  const wallAxis = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  const sprite = WALL_SPRITES.reduce((a, b) =>
    Math.abs(lineDelta(wallAxis, a.axisDeg)) <= Math.abs(lineDelta(wallAxis, b.axisDeg)) ? a : b,
  );
  // One scale for every sprite (they share a sheet), set so the horizontal
  // wall spans WALL_LENGTH_FRACTION of an edge.
  const k = (length * WALL_LENGTH_FRACTION) / WALL_REFERENCE_LENGTH_PX;
  return (
    <TintedSprite
      art={sprite.art}
      color={edge.ownerColor ?? '#8B4513'}
      x={-sprite.anchorX * k}
      y={-sprite.anchorY * k}
      width={sprite.w * k}
      height={sprite.h * k}
      transform={`translate(${(start.x + end.x) / 2},${(start.y + end.y) / 2}) rotate(${lineDelta(wallAxis, sprite.axisDeg)})`}
      pointerEvents="none"
    />
  );
};

/**
 * A settlement/city: whole-town art with the roofs tinted to the owner's
 * color. Clicking/hovering the art acts on its vertex, like the vertex dot.
 */
const Town: React.FC<{
  vertex: BoardVertexRender;
  onClick: (vertexId: string) => void;
  onHover: (vertexId: string | null) => void;
}> = ({ vertex, onClick, onHover }) => {
  const hidden = usePieceHidden(vertex.id);
  if (hidden) return null;
  const { id, position, isSelected, isSelectable } = vertex;
  const isCity = vertex.settlementLevel === 'city';
  const frame = houseFrame(isCity, position, BOARD_VERTEX_SIZE);
  return (
    <g
      onClick={isSelectable ? () => onClick(id) : undefined}
      onMouseEnter={isSelectable ? () => onHover(id) : undefined}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: isSelectable ? 'pointer' : 'default' }}
    >
      <TintedSprite
        art={isCity ? CITY_ART : SETTLEMENT_ART}
        color={vertex.ownerColor ?? '#999'}
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
      />
      {isSelected && (
        <circle
          cx={position.x}
          cy={position.y}
          r={BOARD_VERTEX_SIZE * 2.5}
          fill="none"
          stroke="#eb1010"
          strokeWidth={3}
          strokeDasharray="5,5"
          className="blink-circle"
          pointerEvents="none"
        />
      )}
    </g>
  );
};

type Structure =
  | { kind: 'wall'; groundY: number; edge: BoardEdgeRender }
  | { kind: 'town'; groundY: number; vertex: BoardVertexRender };

/**
 * Tall board structures (walls, settlements, cities) in one layer, drawn
 * back to front by where they stand: the lower a piece's footing sits on
 * screen, the nearer the viewer, so it draws over pieces standing behind it.
 * A wall whose footing is above a city is overlapped by the city; a wall in
 * front of a city overlaps it.
 */
export const StructureLayer = React.memo(function StructureLayer({
  vertices,
  edges,
  onVertexClick,
  onVertexHover,
}: {
  vertices: BoardVertexRender[];
  edges: BoardEdgeRender[];
  onVertexClick: (vertexId: string) => void;
  onVertexHover: (vertexId: string | null) => void;
}) {
  const structures: Structure[] = [];
  for (const edge of edges) {
    if (edge.hasRoad && edge.isWall) {
      structures.push({ kind: 'wall', groundY: (edge.start.y + edge.end.y) / 2, edge });
    }
  }
  for (const vertex of vertices) {
    if (vertex.hasSettlement) structures.push({ kind: 'town', groundY: vertex.position.y, vertex });
  }
  structures.sort((a, b) => a.groundY - b.groundY);
  return (
    <>
      {structures.map((s) =>
        s.kind === 'wall' ? (
          <Wall key={`w-${s.edge.id}`} edge={s.edge} />
        ) : (
          <Town key={`t-${s.vertex.id}`} vertex={s.vertex} onClick={onVertexClick} onHover={onVertexHover} />
        ),
      )}
    </>
  );
});
