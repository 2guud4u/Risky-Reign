import React from 'react';
import { PixelCoord } from 'common';
import { BOARD_VERTEX_SIZE, PROJ_SIZE } from '../../constants';

/** Finger glyph size, as a fraction of the hex size (board units, so it
 *  scales with zoom like every other piece). */
const FINGER_SIZE_FRACTION = 0.55;
/** Target ring radius, in multiples of the vertex dot. */
const RING_SCALE = 2.6;

/**
 * Giant bobbing 👇 drawn on the board, its fingertip just above `at`, with an
 * optional caption above it. The finger itself ignores the mouse so presses
 * still reach whatever is underneath. With `onTargetClick`, a pulsing ring is
 * drawn on `at` too — a big, unambiguous click target (the setup coach).
 * Used for the pending robber move and the setup coach.
 */
export const PointerFinger: React.FC<{ at: PixelCoord; label?: string; onTargetClick?: () => void }> = ({
  at,
  label,
  onTargetClick,
}) => {
  const size = PROJ_SIZE * FINGER_SIZE_FRACTION;
  const ringR = BOARD_VERTEX_SIZE * RING_SCALE;
  // The fingertip rests on top of the ring when there is one.
  const tipY = at.y - (onTargetClick ? ringR : 0);
  return (
    <>
      {onTargetClick && (
        <g
          role="button"
          aria-label={label ?? 'Click here'}
          style={{ cursor: 'pointer' }}
          // Keep the press from starting a board pan.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onTargetClick();
          }}
        >
          <circle cx={at.x} cy={at.y} r={ringR} fill="#3b82f6" fillOpacity={0.3} stroke="#fff" strokeWidth={5} />
          <circle cx={at.x} cy={at.y} r={ringR} fill="none" stroke="#2563eb" strokeWidth={3} />
          <circle cx={at.x} cy={at.y} r={ringR * 1.35} fill="none" stroke="#3b82f6" strokeWidth={3} className="blink-circle" />
        </g>
      )}
      <g pointerEvents="none" className="select-none">
        <text
          x={at.x}
          y={tipY}
          textAnchor="middle"
          fontSize={size}
          className="pointer-finger"
          style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))' }}
        >
          👇
        </text>
        {label && (
          <text
            x={at.x}
            y={tipY - size * 1.25}
            textAnchor="middle"
            fontSize={size * 0.32}
            fontWeight="bold"
            fill="#fff"
            stroke="#111827"
            strokeWidth={size * 0.06}
            paintOrder="stroke"
          >
            {label}
          </text>
        )}
      </g>
    </>
  );
};
