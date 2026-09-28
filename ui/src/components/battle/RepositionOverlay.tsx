import React from 'react';
import { Board } from 'common';
import { RepositionTroop } from '../../types/battleModal';
import { FALLBACK_OWNER_COLOR } from '../../utils/battleModal';
import {
  DROP_TARGET_RING_R,
  REPOSITION_ROW_SPACING,
  REPOSITION_SOLDIER_H,
  REPOSITION_SOLDIER_W,
} from '../../constants';

interface RepositionOverlayProps {
  board: Board;
  /** Injured survivors already placed on a vertex (stacked on top). */
  placedTroops: RepositionTroop[];
  /** The selected staged troop's valid target vertices (lit + clickable). */
  selectedTargets: string[];
  currentPlayerName: string | undefined;
  colors: Record<string, string>;
  /** Click a lit vertex to place the selected troop. */
  onAssign: (vertexId: string) => void;
}

/**
 * Repositioning overlay drawn inside the mini-map svg. Lit rings mark the
 * vertices the selected staged troop may move to (click one to place it);
 * troops already moved stack in a column just above their target vertex.
 */
export const RepositionOverlay: React.FC<RepositionOverlayProps> = ({
  board,
  placedTroops,
  selectedTargets,
  currentPlayerName,
  colors,
  onAssign,
}) => (
  <>
    {/* Lit target vertices for the selected staged troop. */}
    {selectedTargets.map((tid) => {
      const v = board.vertices[tid];
      if (!v) return null;
      return (
        <g key={`t-${tid}`} onClick={() => onAssign(tid)} style={{ cursor: 'pointer' }}>
          <circle
            cx={v.position.x}
            cy={v.position.y}
            r={DROP_TARGET_RING_R}
            fill="#22c55e"
            fillOpacity={0.15}
            stroke="#22c55e"
            strokeWidth={3}
            strokeDasharray="4,3"
          />
        </g>
      );
    })}

    {/* Placed troops stack in a column on top of their vertex. */}
    {(() => {
      const myTroops = placedTroops.filter((t) => currentPlayerName === t.ownerName);
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
          // Stack vertically above the vertex, newest on top.
          const cx = v.position.x;
          const cy = v.position.y - REPOSITION_ROW_SPACING * (n - k);
          out.push(
            <g key={`i-${t.soldierId}`}>
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
  </>
);
