import React from 'react';
import { SoldierObj } from 'common';
import { SOLDIERS_PER_ROW } from '../utils/soldierPlacement';
import { RANK_OFFSET, RANK_SPACING, SOLDIER_SPACING } from '../constants';

interface SoldierGroupProps {
  /** The soldiers in this group. */
  group: SoldierObj[];
  /** Owner name (for tinting). */
  ownerName: string;
  /** Player name -> color, used to tint soldiers. */
  playerColors?: Record<string, string>;
  /** Radial direction from the vertex center to this group (unit vector). */
  dx: number;
  dy: number;
  /** Vertex center position. */
  cx: number;
  cy: number;
  /** Global shrink factor (1 = normal, <1 = squished). */
  shrink?: number;
  /** Click handler for soldiers. */
  onSoldierClick?: (soldierId: string) => void;
  /** Soldier ids currently in the selected group (highlighted). */
  selectedSoldierIds?: ReadonlySet<string>;
  /** Soldier ids the current player may click to select. */
  selectableSoldierIds?: ReadonlySet<string>;
  /** Soldier ids with an unspent action (pulsed). */
  canActSoldierIds?: ReadonlySet<string>;
  /** Collect the rendered soldier positions (for viewBox sizing). */
  onPoints?: (points: { x: number; y: number }[]) => void;
}

/**
 * Renders one owner's garrisoned soldiers as a set of ranks fanned out from
 * the vertex center in the given radial direction. Ranks run perpendicular
 * to the radial direction; each rank holds up to SOLDIERS_PER_ROW troops.
 * A global `shrink` factor scales both the spacing and the soldier size so
 * a large formation fits the view without clipping.
 */
const SoldierGroup: React.FC<SoldierGroupProps> = ({
  group,
  ownerName,
  playerColors,
  dx,
  dy,
  cx,
  cy,
  shrink = 1,
  onSoldierClick,
  selectedSoldierIds,
  selectableSoldierIds,
  canActSoldierIds,
  onPoints,
}) => {
  // Ranks run perpendicular to the radial direction.
  const px = -dy;
  const py = dx;
  // For left/right groups (horizontal radial), the ranks are spaced
  // horizontally. Since the sprite is tall (not wide), tighten the rank
  // spacing so the rows are closer together. For diagonal (corner) groups,
  // the anchor is farther from the center, so the ranks can be even
  // tighter.
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  const isDiagonal = Math.abs(dx) === Math.abs(dy) && dx !== 0;
  // Corner groups hug the edge of the minimap — use a larger offset so
  // they start closer to the corners.
  const rankOffset = isDiagonal ? RANK_OFFSET * 1.5 : RANK_OFFSET;
  const rankSpacing = isDiagonal
    ? RANK_SPACING * 0.5
    : isHorizontal
    ? RANK_SPACING * 0.6
    : RANK_SPACING;
  const points: { x: number; y: number }[] = [];
  const elements: React.ReactNode[] = [];

  group.forEach((s, k) => {
    const row = Math.floor(k / SOLDIERS_PER_ROW);
    const along = (rankOffset + row * rankSpacing) * shrink;
    const inRow = k % SOLDIERS_PER_ROW;
    const countInRow = Math.min(SOLDIERS_PER_ROW, group.length - row * SOLDIERS_PER_ROW);
    const across = (inRow - (countInRow - 1) / 2) * SOLDIER_SPACING * shrink;
    const x = cx + dx * along + px * across;
    const y = cy + dy * along + py * across;
    points.push({ x, y });
    const selectable = selectableSoldierIds?.has(s.id) ?? false;
    const isSel = selectedSoldierIds?.has(s.id) ?? false;
    const canAct = canActSoldierIds?.has(s.id) ?? false;
    const scale = (s.injured ? 0.65 : 1) * shrink;
    elements.push(
      <g
        key={`s-${s.id}`}
        className={canAct ? 'pulse-soldier' : undefined}
        style={{ cursor: selectable && onSoldierClick ? 'pointer' : undefined }}
        onClick={selectable && onSoldierClick ? () => onSoldierClick(s.id) : undefined}
      >
        <svg
          x={x - 28.5 * scale}
          y={y - 33 * scale}
          width={57 * scale}
          height={70 * scale}
          style={{ color: playerColors?.[ownerName] ?? '#888' }}
          transform={x < cx ? `translate(${28.5 * 2 * scale}, 0) scale(-1, 1)` : undefined}
        >
          <use
            href={s.injured ? '/art/injuredSoldier.svg#injured-soldier-shape' : '/art/soldier.svg#soldier-shape'}
            width={57 * scale}
            height={66 * scale}
          />
        </svg>
        {isSel && (
          <rect
            x={x - 15 * scale}
            y={y - 35 * scale}
            width={30 * scale}
            height={70 * scale}
            fill="none"
            stroke={'#facc15'}
            strokeWidth={isSel ? 3 : s.injured ? 2 : 1.5}
          />
        )}
      </g>
    );
  });

  if (onPoints) onPoints(points);

  return <>{elements}</>;
};

export default SoldierGroup;
