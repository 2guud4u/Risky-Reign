import React from 'react';
import { Board, EdgeNode, GAME_HEX_SIZE, terrainColors, VertexNode, cubeToPixel } from 'common';

interface MiniViewProps {
  board: Board;
  type: 'vertex' | 'edge';
  id: string;
}

/** Board vertex/edge positions are pre-projected at GAME_HEX_SIZE. */
const HEX_SIZE = GAME_HEX_SIZE;

const hexPoints = (x: number, y: number, size: number): string =>
  [
    [0, -1],
    [Math.sqrt(3) / 2, -0.5],
    [Math.sqrt(3) / 2, 0.5],
    [0, 1],
    [-Math.sqrt(3) / 2, 0.5],
    [-Math.sqrt(3) / 2, -0.5],
  ]
    .map(([px, py]) => `${(px * size + x).toFixed(1)},${(py * size + y).toFixed(1)}`)
    .join(' ');

/**
 * Small SVG preview of the selected board object and its immediate
 * neighborhood: the adjacent hexes (terrain-colored, with tokens), the
 * incident edges and neighboring vertices, with the selection highlighted.
 */
const MiniView: React.FC<MiniViewProps> = ({ board, type, id }) => {
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

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = 34;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const size = Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return (
    <svg
      width={140}
      height={140}
      viewBox={`${cx - size / 2} ${cy - size / 2} ${size} ${size}`}
      className="mx-auto rounded-md bg-gray-50"
    >
      {hexes.map((h) => (
        <g key={h.id}>
          <polygon
            points={hexPoints(cubeToPixel(h.coord, HEX_SIZE).x, cubeToPixel(h.coord, HEX_SIZE).y, HEX_SIZE)}
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
    </svg>
  );
};

export default MiniView;
