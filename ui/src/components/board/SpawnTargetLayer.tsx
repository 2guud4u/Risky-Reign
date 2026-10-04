import React from 'react';
import { PixelCoord } from 'common';
import { BOARD_VERTEX_SIZE } from '../../constants';

/** Target ring radius, in multiples of the vertex dot. */
const RING_SCALE = 3;

/**
 * Knight spawn targets: while a played Knight is waiting for its soldier,
 * every vertex where the player already has a soldier gets a pulsing ring.
 * Clicking a ring selects that vertex (which opens its 🛡️ spawn bubble).
 * Drawn above the soldiers so the rings are always visible and clickable.
 */
export const SpawnTargetLayer = React.memo(function SpawnTargetLayer({
  targets,
  onSelect,
}: {
  targets: { id: string; position: PixelCoord }[];
  onSelect: (vertexId: string) => void;
}) {
  const r = BOARD_VERTEX_SIZE * RING_SCALE;
  return (
    <>
      {targets.map((t) => (
        <g
          key={t.id}
          role="button"
          aria-label="Spawn the knight's soldier here"
          style={{ cursor: 'pointer' }}
          // Keep the press from starting a board pan.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(t.id);
          }}
        >
          <title>Spawn the knight's soldier here</title>
          <circle cx={t.position.x} cy={t.position.y} r={r} fill="#22c55e" fillOpacity={0.18} />
          <circle
            cx={t.position.x}
            cy={t.position.y}
            r={r}
            fill="none"
            stroke="#16a34a"
            strokeWidth={3}
            strokeDasharray="6,4"
            className="blink-circle"
          />
        </g>
      ))}
    </>
  );
});
