import React from 'react';
import { PixelCoord } from 'common';
import { BOARD_VERTEX_SIZE } from '../../constants';
import { C } from '../../theme';

/** Target ring radius, in multiples of the vertex dot. */
const RING_SCALE = 3;

const TONES = {
  green: { fill: C['board.checkSoft'], ring: C['board.check'] },
  blue: { fill: C['board.targetBlue'], ring: C['sky.soft'] },
} as const;

/**
 * Pulsing click-target rings over board vertices: knight spawn spots (green),
 * sail destinations and disembark landings (blue). Clicking a ring selects
 * that vertex — the click handler decides what it means (spawn, sail hop,
 * landing). Drawn above the soldiers so the rings stay visible and clickable.
 * `badge` stamps a small count on the ring (sail: the hop distance), and
 * `onHover` reports the hovered target (sail: previews the route).
 */
export const SpawnTargetLayer = React.memo(function SpawnTargetLayer({
  targets,
  onSelect,
  onHover,
  label = 'Spawn the knight\'s soldier here',
  tone = 'green',
}: {
  targets: { id: string; position: PixelCoord; badge?: string | number }[];
  onSelect: (vertexId: string) => void;
  onHover?: (vertexId: string | null) => void;
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
          onMouseEnter={onHover ? () => onHover(t.id) : undefined}
          onMouseLeave={onHover ? () => onHover(null) : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(t.id);
          }}
        >
          <title>{label}</title>
          <circle cx={t.position.x} cy={t.position.y} r={r} fill={colors.fill} fillOpacity={0.3} stroke={C['white']} strokeWidth={5} />
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
          {t.badge !== undefined && (
            <>
              <circle
                cx={t.position.x + r}
                cy={t.position.y - r}
                r={r * 0.55}
                fill={C['white']}
                stroke={colors.ring}
                strokeWidth={2}
              />
              <text
                x={t.position.x + r}
                y={t.position.y - r}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={r * 0.75}
                fontWeight={700}
                fill={colors.ring}
                style={{ pointerEvents: 'none' }}
              >
                {t.badge}
              </text>
            </>
          )}
        </g>
      ))}
    </>
  );
});
