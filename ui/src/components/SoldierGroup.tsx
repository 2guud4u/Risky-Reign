import React from 'react';
import { SoldierObj } from 'common';
import {
  RANK_SPACING,
  SOLDIER_SPACING,
  SOLDIER_ART_WIDTH,
  SOLDIER_ART_HEIGHT,
  CLUSTER_MAX_RADIUS,
  COMPACT_MAX,
  AGGREGATE_MAX_VISIBLE,
  AGGREGATE_BADGE_RADIUS,
} from '../constants';

interface SoldierGroupProps {
  /** The soldiers in this group. */
  group: SoldierObj[];
  /** Owner name (for tinting). */
  ownerName: string;
  /** Player name -> color, used to tint soldiers. */
  playerColors?: Record<string, string>;
  /** The cluster center (world coordinates). */
  anchor: { x: number; y: number };
  /**
   * When true, every soldier in this army is mirrored so the whole army faces
   * the same direction (computed from the army's position relative to the
   * vertex). Applied uniformly, not per-soldier.
   */
  flip?: boolean;
  /** Click handler for soldiers. */
  onSoldierClick?: (soldierId: string) => void;
  /** Soldier ids currently in the selected group (highlighted). */
  selectedSoldierIds?: ReadonlySet<string>;
  /** Soldier ids the current player may click to select for a group action. */
  selectableSoldierIds?: ReadonlySet<string>;
  /** Soldier ids with an unspent action (pulsed to show they can still be used). */
  canActSoldierIds?: ReadonlySet<string>;
  /** Collect the rendered soldier positions (for viewBox sizing). */
  onPoints?: (points: { x: number; y: number }[]) => void;
}

/**
 * Renders one owner's garrisoned soldiers as a bounded cluster centered on
 * `anchor`. The layout adapts to the troop count:
 *  - full (≤ FULL_MAX): every soldier, normal spacing.
 *  - compact (≤ COMPACT_MAX): every soldier, compressed to fit CLUSTER_MAX_RADIUS.
 *  - aggregate (> COMPACT_MAX): a bounded number of representative soldiers plus a
 *    central count badge, so a huge army never renders hundreds of SVG elements.
 * Soldiers are laid out in a roughly-square grid centered on the anchor and
 * scaled so the whole cluster fits within CLUSTER_MAX_RADIUS.
 */
const SoldierGroup: React.FC<SoldierGroupProps> = ({
  group,
  ownerName,
  playerColors,
  anchor,
  flip = false,
  onSoldierClick,
  selectedSoldierIds,
  selectableSoldierIds,
  canActSoldierIds,
  onPoints,
}) => {
  const count = group.length;
  const isAggregate = count > COMPACT_MAX;
  const visibleCount = isAggregate ? Math.min(AGGREGATE_MAX_VISIBLE, count) : count;

  // Roughly-square grid centered on the anchor.
  const cols = Math.max(1, Math.ceil(Math.sqrt(visibleCount)));
  const rows = Math.max(1, Math.ceil(visibleCount / cols));
  // Scale the spacing so the cluster fits within CLUSTER_MAX_RADIUS.
  const naturalExtent = Math.max((rows - 1) * RANK_SPACING, (cols - 1) * SOLDIER_SPACING);
  const maxExtent = 2 * CLUSTER_MAX_RADIUS;
  const scale = naturalExtent > maxExtent ? maxExtent / naturalExtent : 1;
  const colSpacing = SOLDIER_SPACING * scale;
  const rowSpacing = RANK_SPACING * scale;

  const points: { x: number; y: number }[] = [];
  const elements: React.ReactNode[] = [];

  for (let k = 0; k < visibleCount; k++) {
    const s = group[k];
    const row = Math.floor(k / cols);
    const col = k % cols;
    const countInRow = Math.min(cols, visibleCount - row * cols);
    const x = anchor.x + (col - (countInRow - 1) / 2) * colSpacing;
    const y = anchor.y + (row - (rows - 1) / 2) * rowSpacing;
    points.push({ x, y });
    const selectable = selectableSoldierIds?.has(s.id) ?? false;
    const isSel = selectedSoldierIds?.has(s.id) ?? false;
    const canAct = canActSoldierIds?.has(s.id) ?? false;
    // Injured soldiers render a bit smaller; the cluster `scale` bounds the group.
    const sScale = (s.injured ? 0.65 : 1) * scale;
    // The sprite, <use>, and selection box are all sized to the actual art
    // (SOLDIER_ART_WIDTH x SOLDIER_ART_HEIGHT, matching the symbol's aspect
    // ratio) and centered on (x, y), so the art fills the viewport and the box
    // tightly wraps it.
    const aw = SOLDIER_ART_WIDTH * sScale;
    const ah = SOLDIER_ART_HEIGHT * sScale;
    elements.push(
      <g
        key={`s-${s.id}`}
        className={canAct ? 'pulse-soldier' : undefined}
        style={{ cursor: selectable && onSoldierClick ? 'pointer' : undefined }}
        onClick={selectable && onSoldierClick ? () => onSoldierClick(s.id) : undefined}
      >
        <svg
          x={x - aw / 2}
          y={y - ah / 2}
          width={aw}
          height={ah}
          style={{ color: playerColors?.[ownerName] ?? '#888' }}
          transform={flip ? `translate(${2 * x}, 0) scale(-1, 1)` : undefined}
        >
          <use
            href={s.injured ? '/art/injuredSoldier.svg#injured-soldier-shape' : '/art/soldier.svg#soldier-shape'}
            width={aw}
            height={ah}
          />
        </svg>
        {isSel && (
          <rect
            x={x - aw / 2}
            y={y - ah / 2}
            width={aw}
            height={ah}
            fill="none"
            stroke="#facc15"
            strokeWidth={isSel ? 3 : s.injured ? 2 : 1.5}
          />
        )}
      </g>
    );
  }

  // Aggregate: a central count badge on top of the representative soldiers.
  if (isAggregate) {
    elements.push(
      <g key="count-badge" style={{ pointerEvents: 'none' }}>
        <circle
          cx={anchor.x}
          cy={anchor.y}
          r={AGGREGATE_BADGE_RADIUS * scale}
          fill={playerColors?.[ownerName] ?? '#888'}
          stroke="#fff"
          strokeWidth={2}
          opacity={0.9}
        />
        <text
          x={anchor.x}
          y={anchor.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={AGGREGATE_BADGE_RADIUS * scale}
          fontWeight="bold"
        >
          {count}
        </text>
      </g>
    );
  }

  if (onPoints) onPoints(points);

  return <>{elements}</>;
};

export default SoldierGroup;
