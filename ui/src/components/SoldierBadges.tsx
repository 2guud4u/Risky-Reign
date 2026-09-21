import React from 'react';
import { VertexNode } from 'common';
import {
  PROJ_SIZE,
  SOLDIER_BADGE_GAP,
  SOLDIER_BADGE_R,
  SOLDIER_BADGE_ROW_OFFSET_FRACTION,
} from '../constants';

interface SoldierBadgesProps {
  /** vertexId -> (ownerName -> count). */
  soldierGroups: Map<string, Map<string, number>>;
  /** vertexId -> vertex (for its position). */
  vertices: Record<string, VertexNode>;
  /** Owner name -> chosen color (tints the badge). */
  colorOf: (ownerName: string) => string | undefined;
  /** Whether the current player may drag this owner's soldiers. */
  canDragSoldier: (ownerName: string) => boolean;
  /** (vertexId, ownerName) -> first soldier id (the drag handle). */
  soldierDragId: Map<string, string>;
  /** Start a soldier drag. */
  onDragStart: (e: React.MouseEvent, soldierId: string, ownerName: string, vertexId: string) => void;
  /** Select a vertex. */
  onSelect: (obj: { type: 'vertex'; id: string }) => void;
}

/**
 * Soldiers layer: count badges for each vertex, rendered as a horizontal row
 * below the vertex (so they don't cover the building image).
 */
export const SoldierBadges: React.FC<SoldierBadgesProps> = ({
  soldierGroups,
  vertices,
  colorOf,
  canDragSoldier,
  soldierDragId,
  onDragStart,
  onSelect,
}) => (
  <>
    {Array.from(soldierGroups.entries()).map(([vertexId, byOwner]) => {
      const v = vertices[vertexId];
      if (!v) return null;
      const entries = Array.from(byOwner.entries());
      return (entries as [string, number][]).map(([ownerName, count], i) => {
        // Horizontal row of badges below the vertex (so they don't cover
        // the building image); centered under the vertex.
        const badgeDiameter = 2 * SOLDIER_BADGE_R;
        const totalWidth = entries.length * badgeDiameter + (entries.length - 1) * SOLDIER_BADGE_GAP;
        const startX = v.position.x - totalWidth / 2 + badgeDiameter / 2;
        const cx = startX + i * (badgeDiameter + SOLDIER_BADGE_GAP);
        const cy = v.position.y + PROJ_SIZE * SOLDIER_BADGE_ROW_OFFSET_FRACTION;
        const color = colorOf(ownerName);
        const draggable = canDragSoldier(ownerName);
        const dragId = soldierDragId.get(`${vertexId}|${ownerName}`);
        return (
          <g
            key={`${vertexId}-${ownerName}`}
            onMouseDown={(e) => {
              if (dragId) onDragStart(e, dragId, ownerName, vertexId);
            }}
            onClick={() => onSelect({ type: 'vertex', id: vertexId })}
            style={{ cursor: draggable ? 'grab' : 'pointer' }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={SOLDIER_BADGE_R}
              fill={color ?? '#888'}
              stroke="#222"
              strokeWidth={1.5}
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight="bold"
              fill="white"
              pointerEvents="none"
            >
              {count}
            </text>
          </g>
        );
      });
    })}
  </>
);
