import React from 'react';
import { PixelCoord } from 'common';
import { BOARD_VERTEX_SIZE } from '../../constants';

/** Target ring radius, in multiples of the vertex dot. */
const RING_SCALE = 3;

const TONES = {
  green: { fill: '#22c55e', ring: '#16a34a' },
  blue: { fill: '#38bdf8', ring: '#0284c7' },
} as const;

/**
 * Pulsing click-target rings over board vertices: knight spawn spots (green),
 * sail destinations and disembark landings (blue). Clicking a ring selects
 * that vertex — the click handler decides what it means (spawn, sail hop,
 * landing). Drawn above the soldiers so the rings stay visible and clickable.
 */
export const SpawnTargetLayer = React.memo(function SpawnTargetLayer({
  targets,
  onSelect,
  label = 'Spawn the knight\'s soldier here',
  tone = 'green',
}: {
  targets: { id: string; position: PixelCoord }[];
  onSelect: (vertexId: string) => void;
  /** aria-label/title for each ring. */
  label?: string;
  tone?: keyof typeof TONES;
}) {
  const r = BOARD_VERTEX_SIZE * RING_SCALE;
  const colors = TONES[tone];
  return (
    <>
      {targets.map((t) => (
        <g
          key={t.id}
          role="button"
          aria-label={label}
          style={{ cursor: 'pointer' }}
          // Keep the press from starting a board pan.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(t.id);
          }}
        >
          <title>{label}</title>
          <circle cx={t.position.x} cy={t.position.y} r={r} fill={colors.fill} fillOpacity={0.3} stroke="#fff" strokeWidth={5} />
          <circle cx={t.position.x} cy={t.position.y} r={r} fill="none" stroke={colors.ring} strokeWidth={3} />
          {/* Pulsing outer halo: draws the eye without ever fading the ring itself. */}
          <circle
            cx={t.position.x}
            cy={t.position.y}
            r={r * 1.35}
            fill="none"
            stroke={colors.fill}
            strokeWidth={3}
            className="blink-circle"
          />
        </g>
      ))}
    </>
  );
});
