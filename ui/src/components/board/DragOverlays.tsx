import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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
import { DragSettle, SoldierDragState } from '../../types/board';
import { C } from '../../theme';

/** Settle spring: quick, slightly under-damped — lands with a soft pop. */
const SETTLE_SPRING = { type: 'spring' as const, stiffness: 320, damping: 22 };

/**
 * The post-drop ghost: while a `DragSettle` is live it springs from the
 * drop point to the landing (target on a hit, origin on a miss), then
 * reports completion so the hook clears it. Under reduced motion the caller
 * never creates a settle.
 */
const SettleGhost: React.FC<{ settle: DragSettle; onDone: () => void }> = ({ settle, onDone }) => {
  useEffect(() => {
    // Safety: if the animation is ever interrupted (rare), don't leak.
    const t = window.setTimeout(onDone, 900);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (settle.kind === 'soldier') {
    return (
      <motion.circle
        initial={{ cx: settle.from.x, cy: settle.from.y, opacity: DRAG_GHOST_OPACITY }}
        animate={{ cx: settle.to.x, cy: settle.to.y, opacity: 0.9 }}
        transition={{ ...SETTLE_SPRING, opacity: { duration: 0.35 } }}
        onAnimationComplete={onDone}
        r={SOLDIER_BADGE_R}
        fill={settle.color ?? C['board.fallback']}
        stroke={C['fight.ball']}
        strokeWidth={1.5}
        pointerEvents="none"
      />
    );
  }
  return (
    <motion.image
      href="/art/robber.png"
      initial={{ x: settle.from.x - (PROJ_SIZE * ROBBER_W_FRACTION) / 2, y: settle.from.y - (PROJ_SIZE * ROBBER_H_FRACTION) / 2, opacity: ROBBER_GHOST_OPACITY }}
      animate={{ x: settle.to.x - (PROJ_SIZE * ROBBER_W_FRACTION) / 2, y: settle.to.y - (PROJ_SIZE * ROBBER_H_FRACTION) / 2, opacity: 0.9 }}
      transition={{ ...SETTLE_SPRING, opacity: { duration: 0.35 } }}
      onAnimationComplete={onDone}
      width={PROJ_SIZE * ROBBER_W_FRACTION}
      height={PROJ_SIZE * ROBBER_H_FRACTION}
      preserveAspectRatio="xMidYMid meet"
      pointerEvents="none"
    />
  );
};

/**
 * Drag feedback overlays: valid drop-target rings for a soldier drag, and the
 * ghost (soldier badge circle or robber image) that follows the cursor, plus
 * the post-drop settle ghost.
 */
export const DragOverlays: React.FC<{
  /** Active soldier drag (drives the target rings and ghost). */
  drag: SoldierDragState | null;
  /** True while the robber is being dragged. */
  robberDrag: boolean;
  /** Cursor position in SVG world coordinates. */
  mousePos: PixelCoord | null;
  /** Post-drop settle ghost (landing / snap-back), if any. */
  settle: DragSettle | null;
  /** Called when the settle spring finishes (or, under reduced motion, immediately). */
  onSettleDone: () => void;
  /** vertexId -> vertex (for drop-target positions). */
  vertices: Record<string, VertexNode>;
  /** Owner name -> chosen color (tints the soldier ghost). */
  colorOf: (ownerName: string) => string | undefined;
}> = ({ drag, robberDrag, mousePos, settle, onSettleDone, vertices, colorOf }) => {
  const reduce = useReducedMotion();
  // Reduced motion: skip the settle entirely — the drop resolves instantly.
  useEffect(() => {
    if (reduce && settle) onSettleDone();
  }, [reduce, settle, onSettleDone]);

  return (
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
              stroke={C['board.checkSoft']}
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
          fill={colorOf(drag.ownerName) ?? C['board.fallback']}
          opacity={DRAG_GHOST_OPACITY}
          stroke={C['fight.ball']}
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
      {/* Post-drop settle: springs to the landing or snaps back home. */}
      {settle && !reduce && <SettleGhost settle={settle} onDone={onSettleDone} />}
    </>
  );
};
