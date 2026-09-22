import React from 'react';
import { BoardHex } from 'common';
import { hexPointsAt } from '../utils/hex';
import TerrainBackground from './TerrainBackground';
import { ROBBER_W_FRACTION, ROBBER_H_FRACTION, ROBBER_Y_OFFSET_FRACTION } from '../constants';

interface HexagonProps {
  hex: BoardHex;
  size: number;
  /** Click handler (e.g. placing the robber on this hex). */
  onClick?: (hexId: string) => void;
  /** Draw a dashed highlight ring (e.g. valid robber targets). */
  highlight?: boolean;
  /** Drag handler for the robber (called on mousedown on the robber circle). */
  onRobberMouseDown?: (e: React.MouseEvent) => void;
  /** Whether the robber is draggable (changes cursor). */
  robberDraggable?: boolean;
}

/**
 * Renders a single hex tile. The center position is pre-computed by the
 * adapter (BoardHex.position), so this component only projects the six
 * corners around that center — no cube-coord math here.
 */
const Hexagon: React.FC<HexagonProps> = ({ hex, size, onClick, highlight, onRobberMouseDown, robberDraggable }) => {
  const { x, y } = hex.position;

  const hexPoints = hexPointsAt(x, y, size);

  return (
    <g
      onClick={onClick ? () => onClick(hex.id) : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {/* Terrain background (artwork, or flat-color fallback). */}
      <TerrainBackground x={x} y={y} size={size} terrain={hex.terrain} points={hexPoints} />
      {/* Hex border. */}
      <polygon points={hexPoints} fill="none" stroke="#000" strokeWidth="2" />

      {hex.rollNumber !== null && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFF"
          fontSize={size / 3}
          fontWeight="bold"
        >
          {hex.rollNumber}
        </text>
      )}

      {hex.hasRobber && (
        <image
          href="/art/robber.png"
          x={x - (size * ROBBER_W_FRACTION) / 2}
          y={y - size * ROBBER_Y_OFFSET_FRACTION}
          width={size * ROBBER_W_FRACTION}
          height={size * ROBBER_H_FRACTION}
          preserveAspectRatio="xMidYMax meet"
          onMouseDown={onRobberMouseDown}
          style={robberDraggable ? { cursor: 'grab' } : undefined}
        />
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
