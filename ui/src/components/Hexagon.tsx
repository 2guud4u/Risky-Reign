import React from 'react';
import { BoardHex } from 'common';
import { hexPointsAt } from '../utils/hex';
import TerrainBackground from './TerrainBackground';
import {
  ROBBER_W_FRACTION,
  ROBBER_H_FRACTION,
  ROBBER_Y_OFFSET_FRACTION,
  ROLL_NUMBER_STROKE_W,
  LIT_HEX_GOLD,
} from '../constants';
import { C } from '../theme';

interface HexagonProps {
  hex: BoardHex;
  size: number;
  /** Click handler (e.g. placing the robber on this hex). */
  onClick?: (hexId: string) => void;
  /** Draw a dashed highlight ring (e.g. valid robber targets). */
  highlight?: boolean;
  /** Drag handler for the robber (pointerdown on the robber image). */
  onRobberPointerDown?: (e: React.PointerEvent) => void;
  /** Click handler for the robber (opens its action bubbles). */
  onRobberClick?: () => void;
  /** Whether the robber is draggable (changes cursor). */
  robberDraggable?: boolean;
  /** Whether this hex's number matches the current roll (light it up). */
  litUp?: boolean;
  /** Called when the robber on this hex is hovered/unhovered. */
  onRobberHover?: (hexId: string, hovering: boolean) => void;
}

/**
 * Renders a single hex tile. The center position is pre-computed by the
 * adapter (BoardHex.position), so this component only projects the six
 * corners around that center — no cube-coord math here.
 */
const Hexagon: React.FC<HexagonProps> = ({ hex, size, onClick, highlight, onRobberPointerDown, onRobberClick, robberDraggable, litUp, onRobberHover }) => {
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
      <polygon points={hexPoints} fill="none" stroke={litUp ? LIT_HEX_GOLD : C['black']} strokeWidth={litUp ? 3 : 2} />

      {hex.rollNumber !== null && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={litUp ? LIT_HEX_GOLD : C['white']}
          fontSize={size / 3}
          fontWeight="bold"
          paintOrder="stroke"
          stroke={C['black']}
          strokeWidth={ROLL_NUMBER_STROKE_W}
          className="select-none"
          style={litUp ? { filter: `drop-shadow(0 0 5px ${LIT_HEX_GOLD})` } : undefined}
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
          onPointerDown={onRobberPointerDown}
          data-drag-handle={onRobberPointerDown ? true : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onRobberClick?.();
          }}
          onMouseEnter={() => onRobberHover?.(hex.id, true)}
          onMouseLeave={() => onRobberHover?.(hex.id, false)}
          style={{ cursor: robberDraggable ? 'grab' : onRobberClick ? 'pointer' : undefined }}
        />
      )}

      {highlight && (
        <polygon
          points={hexPoints}
          fill="none"
          stroke={C['board.checkSoft']}
          strokeWidth={4}
          strokeDasharray="6,4"
        />
      )}
    </g>
  );
};

export default React.memo(Hexagon);
