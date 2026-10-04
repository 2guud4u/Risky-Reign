import React from 'react';
import { Board, PixelCoord } from 'common';
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
  battleVertexId: string;
  /** Injured survivors still on the battle vertex. */
  stagedTroops: RepositionTroop[];
  /** Injured survivors already moved off (shown on their new vertex). */
  placedTroops: RepositionTroop[];
  /** The troop being moved right now (mine, my turn), if any. */
  selectedId: string | null;
  /** Where the selected troop may go (lit, with an arrow from the battle site). */
  targets: string[];
  /** Ids of troops I may press to pick + drag. */
  pickableIds: ReadonlySet<string>;
  colors: Record<string, string>;
  /** The in-flight drag: ghost position and the target it's over. */
  drag: { at: PixelCoord; overTarget: string | null } | null;
  onTroopPress: (troop: RepositionTroop, e: React.MouseEvent) => void;
  onAssign: (vertexId: string) => void;
}

/** Fraction of the way from the battle site to a target where its arrow stops. */
const ARROW_END = 0.72;
/** Fraction where the arrow starts (clears the troops on the battle site). */
const ARROW_START = 0.28;
/** Moved troops: sprite scale, and how far above their vertex they stand. */
const PLACED_SCALE = 0.75;
const PLACED_LIFT = 0.55;

/** One injured-soldier sprite, optionally highlighted / pressable. */
const InjuredSprite: React.FC<{
  at: PixelCoord;
  color: string;
  scale?: number;
  selected?: boolean;
  dim?: boolean;
  onPress?: (e: React.MouseEvent) => void;
}> = ({ at, color, scale = 1, selected, dim, onPress }) => {
  const w = REPOSITION_SOLDIER_W * scale;
  const h = REPOSITION_SOLDIER_H * scale;
  return (
    <g opacity={dim ? 0.45 : 1} style={{ cursor: onPress ? 'grab' : undefined }} onMouseDown={onPress}>
      {selected && (
        <circle cx={at.x} cy={at.y} r={w * 0.62} fill="#fef3c7" stroke="#f59e0b" strokeWidth={3} className="blink-circle" />
      )}
      <svg x={at.x - w / 2} y={at.y - h / 2} width={w} height={h} style={{ color }}>
        <use href="/art/injuredSoldier.svg#injured-soldier-shape" width={w} height={h} />
      </svg>
    </g>
  );
};

/**
 * Repositioning overlay drawn inside the mini-map svg. The injured troops
 * still on the battle site stand in a row there; press one of yours to pick
 * it and drag it onto a lit vertex (or just click a lit vertex). Arrows run
 * from the battle site to every vertex the picked troop may move to. Troops
 * already moved stand on their new vertex as one small sprite per owner with
 * a count badge.
 */
export const RepositionOverlay: React.FC<RepositionOverlayProps> = ({
  board,
  battleVertexId,
  stagedTroops,
  placedTroops,
  selectedId,
  targets,
  pickableIds,
  colors,
  drag,
  onTroopPress,
  onAssign,
}) => {
  const site = board.vertices[battleVertexId]?.position;
  if (!site) return null;
  const colorOf = (owner: string) => colors[owner] ?? FALLBACK_OWNER_COLOR;

  // Waiting troops: one centered row on the battle site.
  const rowStart = site.x - ((stagedTroops.length - 1) * REPOSITION_ROW_SPACING) / 2;

  // Moved troops: grouped per vertex, then per owner (one sprite + count each).
  const placedGroups = new Map<string, Map<string, number>>();
  for (const t of placedTroops) {
    const byOwner = placedGroups.get(t.vertexId) ?? new Map<string, number>();
    byOwner.set(t.ownerName, (byOwner.get(t.ownerName) ?? 0) + 1);
    placedGroups.set(t.vertexId, byOwner);
  }
  const selected = stagedTroops.find((t) => t.soldierId === selectedId);

  return (
    <>
      <defs>
        <marker id="reposition-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#16a34a" />
        </marker>
      </defs>

      {/* Targets for the troop being moved: an arrow from the site and a lit ring. */}
      {targets.map((tid) => {
        const v = board.vertices[tid]?.position;
        if (!v) return null;
        const lerp = (f: number) => ({ x: site.x + (v.x - site.x) * f, y: site.y + (v.y - site.y) * f });
        const a = lerp(ARROW_START);
        const b = lerp(ARROW_END);
        const hot = drag?.overTarget === tid;
        return (
          <g key={`t-${tid}`} onClick={() => onAssign(tid)} style={{ cursor: 'pointer' }}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#16a34a"
              strokeWidth={4}
              strokeLinecap="round"
              markerEnd="url(#reposition-arrow)"
              opacity={drag && !hot ? 0.5 : 1}
            />
            <circle
              cx={v.x}
              cy={v.y}
              r={DROP_TARGET_RING_R * (hot ? 1.8 : 1.4)}
              fill="#22c55e"
              fillOpacity={hot ? 0.45 : 0.25}
              stroke="#16a34a"
              strokeWidth={hot ? 4 : 3}
              strokeDasharray={hot ? undefined : '5,3'}
              className={hot ? undefined : 'blink-circle'}
            />
            <title>Move here</title>
          </g>
        );
      })}

      {/* Troops already moved: one small sprite per owner per vertex, with a count. */}
      {[...placedGroups].flatMap(([vertexId, byOwner]) => {
        const v = board.vertices[vertexId]?.position;
        if (!v) return [];
        const owners = [...byOwner];
        const spacing = REPOSITION_SOLDIER_W * PLACED_SCALE;
        const startX = v.x - ((owners.length - 1) * spacing) / 2;
        const y = v.y - REPOSITION_SOLDIER_H * PLACED_LIFT;
        return owners.map(([owner, count], i) => {
          const at = { x: startX + i * spacing, y };
          const badgeX = at.x + (REPOSITION_SOLDIER_W * PLACED_SCALE) / 2 - 2;
          const badgeY = at.y - (REPOSITION_SOLDIER_H * PLACED_SCALE) / 2 + 2;
          return (
            <g key={`p-${vertexId}-${owner}`} pointerEvents="none">
              <InjuredSprite at={at} color={colorOf(owner)} scale={PLACED_SCALE} />
              {count > 1 && (
                <>
                  <circle cx={badgeX} cy={badgeY} r={8} fill="#111827" stroke="#fff" strokeWidth={1.5} />
                  <text x={badgeX} y={badgeY} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill="#fff">
                    {count}
                  </text>
                </>
              )}
            </g>
          );
        });
      })}

      {/* Troops still on the battle site (the dragged one is left as a faint placeholder). */}
      {stagedTroops.map((t, i) => {
        const pickable = pickableIds.has(t.soldierId);
        const dragging = !!drag && t.soldierId === selectedId;
        return (
          <InjuredSprite
            key={`s-${t.soldierId}`}
            at={{ x: rowStart + i * REPOSITION_ROW_SPACING, y: site.y }}
            color={colorOf(t.ownerName)}
            selected={t.soldierId === selectedId && !dragging}
            dim={dragging || (!pickable && t.soldierId !== selectedId)}
            onPress={pickable ? (e) => onTroopPress(t, e) : undefined}
          />
        );
      })}

      {/* Drag ghost: the picked troop following the cursor. */}
      {drag && selected && (
        <g pointerEvents="none" style={{ cursor: 'grabbing' }}>
          <InjuredSprite at={drag.at} color={colorOf(selected.ownerName)} />
        </g>
      )}
    </>
  );
};
