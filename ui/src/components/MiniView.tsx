import React, { RefObject } from 'react';
import { Board, EdgeNode, GAME_HEX_SIZE, VertexNode, cubeToPixel } from 'common';
import { hexPointsAt } from '../utils/hex';
import TerrainBackground from './TerrainBackground';
import { SOLDIERS_PER_ROW, groupSoldiersByOwner, ownerAngle } from '../utils/soldierPlacement';
import { RANK_OFFSET, RANK_SPACING, SOLDIER_SPACING } from '../constants';
import { neighborNicknames } from '../utils/neighborLabels';

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
  /** Soldier ids with an unspent action (pulsed to show they can still be used). */
  canActSoldierIds?: ReadonlySet<string>;
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
}

/**
 * Small SVG preview of the selected board object and its immediate
 * neighborhood: the adjacent hexes (terrain-colored, with tokens), the
 * incident edges and neighboring vertices — including owned roads (tinted
 * in the road owner's color) and settlements/cities (in the owner's
 * color) — with the selection highlighted.
 */
const MiniView: React.FC<MiniViewProps> = ({
  board,
  type,
  id,
  playerColors,
  onSoldierClick,
  selectedSoldierIds,
  selectableSoldierIds,
  canActSoldierIds,
  showGarrisonedSoldiers = true,
  children,
  svgRef,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  minViewSize,
}) => {
  const points: { x: number; y: number }[] = [];
  const hexes =
    type === 'vertex'
      ? (board.vertices[id]?.hexIds ?? []).map((hid) => board.hexes[hid]).filter(Boolean)
      : (board.edges[id]?.hexIds ?? []).map((hid) => board.hexes[hid]).filter(Boolean);

  const neighborhood: React.ReactNode[] = [];
  let selected: React.ReactNode = null;

  /** Stroke color/width for an edge line: owned roads are tinted in the
   *  road owner's color and drawn thicker, mirroring the main board. */
  const roadStroke = (edge: EdgeNode): { color: string; width: number } => {
    const road = edge.roadId ? board.roads[edge.roadId] : null;
    return {
      color: road ? (playerColors?.[road.ownerId] ?? '#8B4513') : '#9ca3af',
      width: road ? 6 : 4,
    };
  };

  /** Settlement/city marker at a vertex, matching the main board's
   *  BoardVertex: a circle for a settlement, a square for a city, both in
   *  the owner's color. Returns null when the vertex is unoccupied. */
  const settlementMarker = (v: VertexNode, r: number): React.ReactNode => {
    const settlement = v.settlementId ? board.settlements[v.settlementId] : null;
    if (!settlement) return null;
    const color = playerColors?.[settlement.ownerId] ?? '#8B4513';
    if (settlement.level === 'city') {
      const s = r * 1.8;
      return (
        <rect
          key={`set-${v.id}`}
          x={v.position.x - s / 2}
          y={v.position.y - s / 2}
          width={s}
          height={s}
          fill={color}
          stroke="#333"
          strokeWidth={1.5}
        />
      );
    }
    return (
      <circle
        key={`set-${v.id}`}
        cx={v.position.x}
        cy={v.position.y}
        r={r}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
      />
    );
  };

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

    // Nicknames for the neighbor circles (a, b, c, …) — the same mapping the
    // sidebar's "Move to b" buttons use, so the map and buttons agree.
    const nicknames = neighborNicknames(board, id);

    neighbors.forEach(({ edge, other }) => {
      points.push(other.position);
      const stroke = roadStroke(edge);
      neighborhood.push(
        <line
          key={edge.id}
          x1={vertex.position.x}
          y1={vertex.position.y}
          x2={other.position.x}
          y2={other.position.y}
          stroke={stroke.color}
          strokeWidth={stroke.width}
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
      const marker = settlementMarker(other, 10);
      if (marker) neighborhood.push(marker);
      // Letter label just outside the circle, on the far side from the
      // selected vertex, so it doesn't sit on the road line.
      const label = nicknames[other.id];
      if (label) {
        const dx = other.position.x - vertex.position.x;
        const dy = other.position.y - vertex.position.y;
        const len = Math.hypot(dx, dy) || 1;
        const lx = other.position.x + (dx / len) * 20;
        const ly = other.position.y + (dy / len) * 20;
        // Fit the glyph's full extent (not just its anchor) into the
        // viewBox, or edge letters get clipped.
        points.push(
          { x: lx - 6, y: ly - 9 },
          { x: lx + 6, y: ly - 9 },
          { x: lx - 6, y: ly + 9 },
          { x: lx + 6, y: ly + 9 }
        );
        neighborhood.push(
          <text
            key={`label-${other.id}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={15}
            fontWeight="bold"
            fill="#111827"
          >
            {label}
          </text>
        );
      }
    });

    // Selected vertex: the owner's settlement marker when present, so the
    // selection ring (blue) still reads as "selected" without hiding the
    // occupancy; otherwise the plain blue dot.
    selected = vertex.settlementId ? (
      <g>
        {settlementMarker(vertex, 11)}
        <circle
          cx={vertex.position.x}
          cy={vertex.position.y}
          r={15}
          fill="none"
          stroke="#2563eb"
          strokeWidth={3}
        />
      </g>
    ) : (
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
          const canAct = canActSoldierIds?.has(s.id) ?? false;
          // Injured soldiers render at 0.65x the size of a healthy soldier.
          const scale = s.injured ? 0.65 : 1;
          neighborhood.push(
            <g
              key={`s-${s.id}`}
              className={canAct ? 'pulse-soldier' : undefined}
              style={{ cursor: selectable && onSoldierClick ? 'pointer' : undefined }}
              onClick={selectable && onSoldierClick ? () => onSoldierClick(s.id) : undefined}
            >
              <svg
                x={cx - 28.5 * scale}
                y={cy - 33 * scale}
                width={57 * scale}
                height={70 * scale}
                style={{ color: playerColors?.[ownerName] ?? '#888' }}
              >
                <use
                  href={s.injured ? '/art/injuredSoldier.svg#injured-soldier-shape' : '/art/soldier.svg#soldier-shape'}
                  width={57 * scale}
                  height={66 * scale}
                />
              </svg>
              {/* Highlight rectangle (yellow for selected, red for injured, white otherwise). */}
              {isSel && <rect
                x={cx - 15}
                y={cy - 35}
                width={30}
                height={70}
                fill="none"
                stroke={'#facc15'}
                strokeWidth={isSel ? 3 : s.injured ? 2 : 1.5}
              />
        }
            </g>
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
        stroke={road ? (playerColors?.[road.ownerId] ?? '#8B4513') : '#2563eb'}
        strokeWidth={6}
        strokeLinecap="round"
      />
    );
    [a, b].forEach((v) => {
      neighborhood.push(
        <circle
          key={`v-${v.id}`}
          cx={v.position.x}
          cy={v.position.y}
          r={9}
          fill="#6b7280"
          stroke="#fff"
          strokeWidth={2}
        />
      );
      const marker = settlementMarker(v, 10);
      if (marker) neighborhood.push(marker);
    });
  }

  hexes.forEach((h) => points.push(cubeToPixel(h.coord, GAME_HEX_SIZE)));
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
      width="100%"
      height="auto"
      viewBox={`${focus.x - size / 2} ${focus.y - size / 2} ${size} ${size}`}
      className="mx-auto rounded-md bg-gray-50"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {hexes.map((h) => {
        const { x, y } = cubeToPixel(h.coord, GAME_HEX_SIZE);
        const points = hexPointsAt(x, y, GAME_HEX_SIZE);
        return (
          <g key={h.id}>
            {/* Terrain background (artwork, or flat-color fallback). */}
            <TerrainBackground x={x} y={y} size={GAME_HEX_SIZE} terrain={h.terrain} points={points} />
            {/* Hex border. */}
            <polygon points={points} fill="none" stroke="#000" strokeWidth={2} />
            {h.rollNumber !== null && (
              <text
                x={x}
                y={y}
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
        );
      })}
      {neighborhood}
      {selected}
      {children}
    </svg>
  );
};

export default MiniView;
