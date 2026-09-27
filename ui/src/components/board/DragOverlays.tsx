import React from 'react';
import { PixelCoord, VertexNode } from 'common';
import {
  DROP_TARGET_RING_R,
  DROP_TARGET_STROKE_W,
  DRAG_GHOST_OPACITY,
  PROJ_SIZE,
  ROBBER_GHOST_OPACITY,
  ROBBER_H_FRACTION,
  ROBBER_W_FRACTION,
  SOLDIER_BADGE_R,
} from '../../constants';
import { SoldierDragState } from '../../types/board';

/**
 * Drag feedback overlays: valid drop-target rings for a soldier drag, and the
 * ghost (soldier badge circle or robber image) that follows the cursor.
 */
export const DragOverlays: React.FC<{
  /** Active soldier drag (drives the target rings and ghost). */
  drag: SoldierDragState | null;
  /** True while the robber is being dragged. */
  robberDrag: boolean;
  /** Cursor position in SVG world coordinates. */
  mousePos: PixelCoord | null;
  /** vertexId -> vertex (for drop-target positions). */
  vertices: Record<string, VertexNode>;
  /** Owner name -> chosen color (tints the soldier ghost). */
  colorOf: (ownerName: string) => string | undefined;
}> = ({ drag, robberDrag, mousePos, vertices, colorOf }) => (
  <>
    {/* Drag feedback: highlight valid drop targets */}
    {drag &&
      drag.validTargets.map((tid) => {
        const v = vertices[tid];
        if (!v) return null;
        return (
          <circle
            key={tid}
            cx={v.position.x}
            cy={v.position.y}
            r={DROP_TARGET_RING_R}
            fill="none"
            stroke="#22c55e"
            strokeWidth={DROP_TARGET_STROKE_W}
            strokeDasharray="4,3"
          />
        );
      })}

    {/* Drag ghost following the cursor */}
    {drag && mousePos && (
      <circle
        cx={mousePos.x}
        cy={mousePos.y}
        r={SOLDIER_BADGE_R}
        fill={colorOf(drag.ownerName) ?? '#888'}
        opacity={DRAG_GHOST_OPACITY}
        stroke="#222"
        strokeWidth={1.5}
        pointerEvents="none"
      />
    )}
    {/* Robber drag ghost following the cursor */}
    {robberDrag && mousePos && (
      <image
        href="/art/robber.png"
        x={mousePos.x - (PROJ_SIZE * ROBBER_W_FRACTION) / 2}
        y={mousePos.y - (PROJ_SIZE * ROBBER_H_FRACTION) / 2}
        width={PROJ_SIZE * ROBBER_W_FRACTION}
        height={PROJ_SIZE * ROBBER_H_FRACTION}
        preserveAspectRatio="xMidYMid meet"
        opacity={ROBBER_GHOST_OPACITY}
        pointerEvents="none"
      />
    )}
  </>
);
