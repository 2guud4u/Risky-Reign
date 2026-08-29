import React from 'react';
import { BoardHex, terrainColors } from 'common';
import { hexPointsAt } from '../utils/hex';

interface HexagonProps {
  hex: BoardHex;
  size: number;
  /** Click handler (e.g. placing the robber on this hex). */
  onClick?: (hexId: string) => void;
  /** Draw a dashed highlight ring (e.g. valid robber targets). */
  highlight?: boolean;
}

/**
 * Renders a single hex tile. The center position is pre-computed by the
 * adapter (BoardHex.position), so this component only projects the six
 * corners around that center — no cube-coord math here.
 */
const Hexagon: React.FC<HexagonProps> = ({ hex, size, onClick, highlight }) => {
  const { x, y } = hex.position;

  const hexPoints = hexPointsAt(x, y, size);

  return (
    <g
      onClick={onClick ? () => onClick(hex.id) : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <polygon
        points={hexPoints}
        fill={terrainColors[hex.terrain] ?? '#DDD'}
        stroke="#000"
        strokeWidth="2"
      />

      {hex.rollNumber !== null && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#000"
          fontSize={size / 3}
          fontWeight="bold"
        >
          {hex.terrain[0]}
          {hex.rollNumber}
        </text>
      )}

      {hex.hasRobber && (
        <circle cx={x} cy={y} r={size / 5} fill="#000" fillOpacity={0.6} />
      )}

      {highlight && (
        <polygon
          points={hexPoints}
          fill="none"
          stroke="#22c55e"
          strokeWidth={4}
          strokeDasharray="6,4"
        />
      )}
    </g>
  );
};

export default Hexagon;
