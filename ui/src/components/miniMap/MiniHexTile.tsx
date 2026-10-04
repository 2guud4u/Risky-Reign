import React from 'react';
import { GAME_HEX_SIZE, HexNode, cubeToPixel } from 'common';
import { hexPointsAt } from '../../utils/hex';
import TerrainBackground from '../TerrainBackground';

/**
 * One hex in the mini-map: terrain background (artwork, or flat-color
 * fallback), a border, and the roll token when the hex has one.
 */
export const MiniHexTile: React.FC<{ hex: HexNode }> = ({ hex }) => {
  const { x, y } = cubeToPixel(hex.coord, GAME_HEX_SIZE);
  const points = hexPointsAt(x, y, GAME_HEX_SIZE);
  return (
    <g>
      <TerrainBackground x={x} y={y} size={GAME_HEX_SIZE} terrain={hex.terrain} points={points} />
      {/* Hex border. */}
      <polygon points={points} fill="none" stroke="#000" strokeWidth={2} />
      {hex.rollNumber !== null && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFF"
          fontSize={16}
          fontWeight="bold"
          className="select-none"
        >
          {hex.rollNumber}
        </text>
      )}
    </g>
  );
};
