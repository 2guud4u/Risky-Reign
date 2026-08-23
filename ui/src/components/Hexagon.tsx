import React from 'react';
import { BoardHex, terrainColors } from 'common';
import { hexPointsAt } from '../utils/hex';

interface HexagonProps {
  hex: BoardHex;
  size: number;
}

/**
 * Renders a single hex tile. The center position is pre-computed by the
 * adapter (BoardHex.position), so this component only projects the six
 * corners around that center — no cube-coord math here.
 */
const Hexagon: React.FC<HexagonProps> = ({ hex, size }) => {
  const { x, y } = hex.position;

  const hexPoints = hexPointsAt(x, y, size);

  return (
    <g>
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
    </g>
  );
};

export default Hexagon;
