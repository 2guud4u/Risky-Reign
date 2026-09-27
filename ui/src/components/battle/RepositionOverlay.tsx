import React from 'react';
import { Board } from 'common';
import { RepositionDrag, RepositionTroop } from '../../types/battleModal';
import { FALLBACK_OWNER_COLOR } from '../../utils/battleModal';
import {
  DROP_TARGET_RING_R,
  REPOSITION_ROW_OFFSET_Y,
  REPOSITION_ROW_SPACING,
  REPOSITION_SOLDIER_H,
  REPOSITION_SOLDIER_W,
  SOLDIER_DOT_R,
} from '../../constants';

interface RepositionOverlayProps {
  board: Board;
  /** Injured survivors at their current resting vertex. */
  injuredTroops: RepositionTroop[];
  drag: RepositionDrag | null;
  mousePos: { x: number; y: number } | null;
  currentPlayerName: string | undefined;
  colors: Record<string, string>;
  onStartDrag: (
    e: React.MouseEvent,
    soldierId: string,
    ownerName: string,
    vertexId: string
  ) => void;
}

/**
 * Repositioning overlay: draggable injured troops. The active drag highlights
 * its valid drop targets; a ghost circle follows the cursor.
 */
export const RepositionOverlay: React.FC<RepositionOverlayProps> = ({
  board,
  injuredTroops,
  drag,
  mousePos,
  currentPlayerName,
  colors,
  onStartDrag,
}) => (
  <>
    {/* Drop-target highlights for the active drag. */}
    {drag &&
      drag.validTargets.map((tid) => {
        const v = board.vertices[tid];
        if (!v) return null;
        return (
          <circle
            key={`t-${tid}`}
            cx={v.position.x}
            cy={v.position.y}
            r={DROP_TARGET_RING_R}
            fill="none"
            stroke="#22c55e"
            strokeWidth={3}
            strokeDasharray="4,3"
          />
        );
      })}

    {/* Injured troops at their current resting vertex. Troops sharing
        a vertex are fanned out on a small ring so each is visible
        and individually draggable. */}
    {(() => {
      // Only show your own soldiers (the ones you need to drag);
      // the enemy's soldiers are hidden until they confirm.
      const myTroops = injuredTroops.filter(
        (t) => currentPlayerName === t.ownerName
      );
      const byVertex = new Map<string, typeof myTroops>();
      for (const t of myTroops) {
        const arr = byVertex.get(t.vertexId) ?? [];
        arr.push(t);
        byVertex.set(t.vertexId, arr);
      }
      const out: React.ReactNode[] = [];
      byVertex.forEach((troops, vertexId) => {
        const v = board.vertices[vertexId];
        if (!v) return;
        const n = troops.length;
        troops.forEach((t, k) => {
          // Row below the vertex (not a ring around it).
          const rowOffset = (k - (n - 1) / 2) * REPOSITION_ROW_SPACING;
          const cx = v.position.x + rowOffset;
          const cy = v.position.y + REPOSITION_ROW_OFFSET_Y;
          out.push(
            <g
              key={`i-${t.soldierId}`}
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => onStartDrag(e, t.soldierId, t.ownerName, t.vertexId)}
            >
              <svg
                x={cx - REPOSITION_SOLDIER_W / 2}
                y={cy - REPOSITION_SOLDIER_H / 2}
                width={REPOSITION_SOLDIER_W}
                height={REPOSITION_SOLDIER_H}
                style={{ color: colors[t.ownerName] ?? FALLBACK_OWNER_COLOR }}
              >
                <use
                  href="/art/injuredSoldier.svg#injured-soldier-shape"
                  width={REPOSITION_SOLDIER_W}
                  height={REPOSITION_SOLDIER_H}
                />
              </svg>
            </g>
          );
        });
      });
      return out;
    })()}

    {/* Drag ghost following the cursor. */}
    {drag && mousePos && (
      <circle
        cx={mousePos.x}
        cy={mousePos.y}
        r={SOLDIER_DOT_R}
        fill={colors[drag.ownerName] ?? FALLBACK_OWNER_COLOR}
        opacity={0.6}
        stroke="#222"
        strokeWidth={1.5}
        pointerEvents="none"
      />
    )}
  </>
);
