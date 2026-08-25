import React, { RefObject } from 'react';
import { Board, EdgeNode, GAME_HEX_SIZE, terrainColors, VertexNode, cubeToPixel } from 'common';
import { hexPointsAt } from '../../utils/hex';
import { SOLDIERS_PER_ROW, groupSoldiersByOwner, ownerAngle } from '../../utils/soldierPlacement';
import { RANK_OFFSET, RANK_SPACING, SOLDIER_SPACING } from '../../constants';

interface MiniViewProps {
  board: Board;
  type: 'vertex' | 'edge';
  id: string;
  /** Player name -> color, used to tint soldier circles. */
  playerColors?: Record<string, string>;
  /** Click handler for soldiers (toggles them in the selected group). */
  onSoldierClick?: (soldierId: string) => void;
  /** Soldier ids currently in the selected group (highlighted). */
  selectedSoldierIds?: ReadonlySet<string>;
  /** Soldier ids the current player may click to select for a group action. */
  selectableSoldierIds?: ReadonlySet<string>;
  /**
   * When false, the default garrisoned-soldier rendering at the selected
   * vertex is skipped (used by the battle arena, which draws its own
   * combatants).
   */
  showGarrisonedSoldiers?: boolean;
  /**
   * Extra content rendered on top of the map, in the same world-coordinate
   * space centered on the selected object (used by the battle arena).
   */
  children?: React.ReactNode;
  /**
   * External ref for the SVG element (so the battle window can map mouse
   * coordinates into world space for drag-and-drop).
   */
  svgRef?: RefObject<SVGSVGElement>;
  /** SVG-level mouse handlers (for drag-and-drop overlays). */
  onMouseMove?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseUp?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<SVGSVGElement>) => void;
  /**
   * Minimum world-space size for the viewBox (squared). When set, the view is
   * at least this large even if the board neighborhood is smaller — used by
   * the battle arena so a wide troop formation isn't zoomed in too much.
   */
  minViewSize?: number;
  /** Rendered pixel size of the SVG (width and height). Defaults to 250. */
  pixelSize?: number;
}

/** Board vertex/edge positions are pre-projected at GAME_HEX_SIZE. */
const HEX_SIZE = GAME_HEX_SIZE;

/**
 * Small SVG preview of the selected board object and its immediate
 * neighborhood: the adjacent hexes (terrain-colored, with tokens), the
 * incident edges and neighboring vertices, with the selection highlighted.
 */
const MiniView: React.FC<MiniViewProps> = ({
  board,
  type,
  id,
  playerColors,
  onSoldierClick,
  selectedSoldierIds,
  selectableSoldierIds,
  showGarrisonedSoldiers = true,
  children,
  svgRef,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  minViewSize,
  pixelSize = 250,
}) => {
  const points: { x: number; y: number }[] = [];
  const hexes =
    type === 'vertex'
      ? (board.vertices[id]?.hexIds ?? []).map((hid) => board.hexes[hid]).filter(Boolean)
      : (board.edges[id]?.hexIds ?? []).map((hid) => board.hexes[hid]).filter(Boolean);

  const neighborhood: React.ReactNode[] = [];
  let selected: React.ReactNode = null;

  if (type === 'vertex') {
    const vertex = board.vertices[id];
    if (!vertex) return null;
    points.push(vertex.position);

    const neighbors = vertex.roadIds
      .map((edgeId) => {
        const edge = board.edges[edgeId];
        if (!edge) return null;
        const otherId = edge.vertexAId === id ? edge.vertexBId : edge.vertexAId;
        const other = board.vertices[otherId];
        return other ? { edge, other } : null;
      })
      .filter(Boolean) as { edge: EdgeNode; other: VertexNode }[];

    neighbors.forEach(({ edge, other }) => {
      points.push(other.position);
      neighborhood.push(
        <line
          key={edge.id}
          x1={vertex.position.x}
          y1={vertex.position.y}
          x2={other.position.x}
          y2={other.position.y}
          stroke="#9ca3af"
          strokeWidth={4}
        />
      );
      neighborhood.push(
        <circle
          key={`v-${other.id}`}
          cx={other.position.x}
          cy={other.position.y}
          r={8}
          fill="#6b7280"
          stroke="#fff"
          strokeWidth={2}
        />
      );
    });

    selected = (
      <circle
        cx={vertex.position.x}
        cy={vertex.position.y}
        r={11}
        fill="#2563eb"
        stroke="#fff"
        strokeWidth={3}
      />
    );

    // Soldiers garrisoned at this vertex: each player's soldiers form their
    // own ranks, placed around the vertex at the same angle as that player's
    // badge on the main board (see BoardView's soldier layer), so the two views
    // agree on orientation.
    // All garrisoned soldiers (including injured, so they can be selected to
    // heal). Each owner forms their own ranks around the vertex.
    if (showGarrisonedSoldiers) {
      const soldiersAt = Object.values(board.soldiers ?? {}).filter((s) => s.vertexId === id);
      const byOwner = groupSoldiersByOwner(soldiersAt);
      let ownerIndex = 0;
      byOwner.forEach((group, ownerName) => {
        const angle = ownerAngle(ownerIndex++, byOwner.size);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        // Ranks run perpendicular to the radial direction.
        const px = -dy;
        const py = dx;
        group.forEach((s, k) => {
          const row = Math.floor(k / SOLDIERS_PER_ROW);
          const inRow = k % SOLDIERS_PER_ROW;
          const countInRow = Math.min(SOLDIERS_PER_ROW, group.length - row * SOLDIERS_PER_ROW);
          const along = RANK_OFFSET + row * RANK_SPACING; // distance from vertex center
          const across = (inRow - (countInRow - 1) / 2) * SOLDIER_SPACING;
          const cx = vertex.position.x + dx * along + px * across;
          const cy = vertex.position.y + dy * along + py * across;
          points.push({ x: cx, y: cy });
          const selectable = selectableSoldierIds?.has(s.id) ?? false;
          const isSel = selectedSoldierIds?.has(s.id) ?? false;
          neighborhood.push(
            <circle
              key={`s-${s.id}`}
              cx={cx}
              cy={cy}
              r={6}
              fill={playerColors?.[ownerName] ?? '#888'}
              stroke={isSel ? '#facc15' : s.injured ? '#dc2626' : '#fff'}
              strokeWidth={isSel ? 3 : s.injured ? 2 : 1.5}
              style={{ cursor: selectable && onSoldierClick ? 'pointer' : undefined }}
              onClick={selectable && onSoldierClick ? () => onSoldierClick(s.id) : undefined}
            />
          );
        });
      });
    }
  } else {
    const edge = board.edges[id];
    if (!edge) return null;
    const a = board.vertices[edge.vertexAId];
    const b = board.vertices[edge.vertexBId];
    if (!a || !b) return null;
    points.push(a.position, b.position);

    const road = edge.roadId ? board.roads[edge.roadId] : null;
    neighborhood.push(
      <line
        key="selected-edge"
        x1={a.position.x}
        y1={a.position.y}
        x2={b.position.x}
        y2={b.position.y}
        stroke={road ? '#8B4513' : '#2563eb'}
        strokeWidth={6}
        strokeLinecap="round"
      />
    );
    [a, b].forEach((v) => {
      const hasSettlement = v.settlementId !== null;
      neighborhood.push(
        <circle
          key={`v-${v.id}`}
          cx={v.position.x}
          cy={v.position.y}
          r={9}
          fill={hasSettlement ? '#8B4513' : '#6b7280'}
          stroke="#fff"
          strokeWidth={2}
        />
      );
    });
  }

  hexes.forEach((h) => points.push(cubeToPixel(h.coord, HEX_SIZE)));
  if (points.length === 0) return null;

  // Center the view on the selected object (vertex position or edge midpoint).
  let focus: { x: number; y: number };
  if (type === 'vertex') {
    focus = board.vertices[id].position;
  } else {
    const e = board.edges[id];
    const a = board.vertices[e.vertexAId];
    const b = board.vertices[e.vertexBId];
    focus = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
  }

  // Size the view to fit everything while keeping the focus point centered.
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = 1;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const bboxSize = Math.max(maxX - minX, maxY - minY);
  const maxDistFromFocus = Math.max(
    ...points.map((p) => Math.hypot(p.x - focus.x, p.y - focus.y))
  );
  const size = Math.max(bboxSize, maxDistFromFocus * 2 + pad * 2, minViewSize ?? 0);

  return (
    <svg
      ref={svgRef}
      width={pixelSize}
      height={pixelSize}
      viewBox={`${focus.x - size / 2} ${focus.y - size / 2} ${size} ${size}`}
      className="mx-auto rounded-md bg-gray-50"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {hexes.map((h) => (
        <g key={h.id}>
          <polygon
            points={hexPointsAt(cubeToPixel(h.coord, HEX_SIZE).x, cubeToPixel(h.coord, HEX_SIZE).y, HEX_SIZE)}
            fill={terrainColors[h.terrain] ?? '#DDD'}
            stroke="#000"
            strokeWidth={2}
          />
          {h.rollNumber !== null && (
            <text
              x={cubeToPixel(h.coord, HEX_SIZE).x}
              y={cubeToPixel(h.coord, HEX_SIZE).y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#000"
              fontSize={16}
              fontWeight="bold"
            >
              {h.rollNumber}
            </text>
          )}
        </g>
      ))}
      {neighborhood}
      {selected}
      {children}
    </svg>
  );
};

export default MiniView;
