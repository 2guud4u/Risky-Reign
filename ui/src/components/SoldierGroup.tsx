import React from 'react';
import { SoldierObj } from 'common';
import {
  FORMATION_PILL_FONT,
  FORMATION_PILL_H,
  CHECK_BADGE_COLOR,
  CHECK_BADGE_R_FRAC,
  CHECK_BADGE_Y_OFF,
  SOLDIER_ART_HEIGHT,
  SOLDIER_ART_WIDTH,
  ACTION_BOLT_FILL,
  ACTION_BOLT_H_FRAC,
  ACTION_BOLT_STROKE,
  ACTION_BOLT_W_FRAC,
  ACTION_BOLT_X_OFF,
  ACTION_BOLT_Y_OFF,
} from '../constants';
import { GarrisonArmy } from '../utils/garrisonFormation';
import { TROOP_SPRITES } from '../utils/tintedArt';
import { TintedSprite } from './TintedSprite';

interface SoldierGroupProps {
  /** The owner's garrison as a formation of ranks. */
  army: GarrisonArmy;
  /** Player name -> color, used to tint soldiers and the count pill. */
  playerColors?: Record<string, string>;
  /** Click handler for soldiers. */
  onSoldierClick?: (soldierId: string) => void;
  /** Soldier ids currently in the selected group (green check badge above the head). */
  selectedSoldierIds?: ReadonlySet<string>;
  /** Soldier ids the current player may click to select for a group action. */
  selectableSoldierIds?: ReadonlySet<string>;
  /** Soldier ids with an unspent action (marked with an energy bolt). */
  canActSoldierIds?: ReadonlySet<string>;
  /** Soldier ids actually draggable right now: only these get the drag
   *  handle, so touching a non-draggable soldier pans the board. */
  draggableSoldierIds?: ReadonlySet<string>;
  /** Start dragging this soldier (the Action-phase move). */
  onSoldierDragStart?: (e: React.PointerEvent, ownerName: string, soldierId: string) => void;
}

/**
 * Renders one owner's garrisoned soldiers as a formation of ranks: healthy
 * soldiers in front, injured (drawn smaller) behind, plus a count pill for
 * the whole army. Soldiers are laid out in ranks of FORMATION_COLS centered
 * on the formation; back ranks sit higher so the front rank draws on top.
 */
const SoldierGroup: React.FC<SoldierGroupProps> = ({
  army,
  playerColors,
  onSoldierClick,
  selectedSoldierIds,
  selectableSoldierIds,
  canActSoldierIds,
  draggableSoldierIds,
  onSoldierDragStart,
}) => {
  const elements: React.ReactNode[] = [];

  for (const fs of army.soldiers) {
    const s: SoldierObj = fs.soldier;
    const selectable = selectableSoldierIds?.has(s.id) ?? false;
    const isSel = selectedSoldierIds?.has(s.id) ?? false;
    const canAct = canActSoldierIds?.has(s.id) ?? false;
    const draggable = draggableSoldierIds?.has(s.id) ?? false;
    // Each troop's own art box (sized so the people match across sprites).
    const { x, y, w: aw, h: ah } = fs;
    // Badge/bolt size follows the person, not the sprite canvas: a cannon's
    // box is mostly gun, so size those off a soldier.
    const markerW = Math.min(aw, SOLDIER_ART_WIDTH);
    const markerH = Math.min(ah, SOLDIER_ART_HEIGHT);
    // Energy bolt marking a soldier that can still act: a small zigzag pinned
    // to the soldier's upper-right. Drawn above the sprite, non-interactive,
    // scaled with the art (injured soldiers get a smaller bolt).
    const bh = markerH * ACTION_BOLT_H_FRAC;
    const bw = bh * ACTION_BOLT_W_FRAC;
    const bx = x + markerW * ACTION_BOLT_X_OFF;
    const by = y - markerH * ACTION_BOLT_Y_OFF;
    const boltPoints = [
      `${bx + bw * 0.3},${by - bh / 2}`,
      `${bx - bw * 0.35},${by + bh * 0.05}`,
      `${bx - bw * 0.05},${by + bh * 0.05}`,
      `${bx - bw * 0.3},${by + bh / 2}`,
      `${bx + bw * 0.35},${by - bh * 0.05}`,
      `${bx + bw * 0.05},${by - bh * 0.05}`,
    ].join(' ');
    // Selected-badge center: a gap above this troop's sprite top.
    const badgeCy = y - ah / 2 - CHECK_BADGE_Y_OFF * SOLDIER_ART_HEIGHT;
    const badgeR = markerW * CHECK_BADGE_R_FRAC;
    elements.push(
      <g
        key={`s-${s.id}`}
        style={{ cursor: draggable ? 'grab' : selectable && onSoldierClick ? 'pointer' : undefined }}
        onClick={selectable && onSoldierClick ? () => onSoldierClick(s.id) : undefined}
        // Drag a movable soldier to move it (the hook re-validates the
        // rules; stopPropagation keeps the board from treating the press
        // as a pan). Only a draggable sprite is a handle — touching any
        // other soldier pans the board instead.
        onPointerDown={onSoldierDragStart ? (e) => onSoldierDragStart(e, army.ownerName, s.id) : undefined}
        data-drag-handle={draggable ? true : undefined}
      >
        <TintedSprite
          art={TROOP_SPRITES[fs.art]}
          color={playerColors?.[army.ownerName] ?? '#888'}
          x={x - aw / 2}
          y={y - ah / 2}
          width={aw}
          height={ah}
          transform={army.flip ? `translate(${2 * x}, 0) scale(-1, 1)` : undefined}
        />
        {canAct && (
          <polygon
            points={boltPoints}
            fill={ACTION_BOLT_FILL}
            stroke={ACTION_BOLT_STROKE}
            strokeWidth={1.4}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}
        {/* Selected-soldier check badge above the head, drawn last so it is
            never hidden by the sprite or the bolt. */}
        {isSel && (
          <g pointerEvents="none">
            <circle cx={x} cy={badgeCy} r={badgeR} fill={CHECK_BADGE_COLOR} stroke="#fff" strokeWidth={1} />
            <path
              d={`M ${x - badgeR * 0.5} ${badgeCy} l ${badgeR * 0.3} ${badgeR * 0.35} l ${badgeR * 0.5} ${-badgeR * 0.55}`}
              fill="none"
              stroke="#fff"
              strokeWidth={Math.max(1, badgeR * 0.28)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
      </g>
    );
  }

  // Count pill under the front rank: the whole army's strength, tinted by owner.
  if (army.group.length > army.soldiers.length) {
    const label = `\u00d7${army.group.length}`;
    elements.push(
      <g key="count-pill" style={{ pointerEvents: 'none' }}>
        <rect
          x={army.pillCenterX - army.pillWidth / 2}
          y={army.pillY}
          width={army.pillWidth}
          height={FORMATION_PILL_H}
          rx={FORMATION_PILL_H / 2}
          fill={playerColors?.[army.ownerName] ?? '#888'}
          stroke="#fff"
          strokeWidth={2}
          opacity={0.95}
        />
        <text
          x={army.pillCenterX}
          y={army.pillY + FORMATION_PILL_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={FORMATION_PILL_FONT}
          fontWeight="bold"
        >
          {label}
        </text>
      </g>
    );
  }

  return <>{elements}</>;
};

export default SoldierGroup;
