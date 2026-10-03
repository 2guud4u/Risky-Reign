import React from 'react';
import { SoldierObj } from 'common';
import {
  FORMATION_PILL_FONT,
  FORMATION_PILL_H,
  CHECK_BADGE_COLOR,
  CHECK_BADGE_R_FRAC,
  CHECK_BADGE_Y_OFF,
  CHECK_BADGE_Y_OFF_INJURED,
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
  /** Start dragging this soldier (the Action-phase move). */
  onSoldierDragStart?: (e: React.MouseEvent, ownerName: string, soldierId: string) => void;
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
  onSoldierDragStart,
}) => {
  const elements: React.ReactNode[] = [];

  for (const fs of army.soldiers) {
    const s: SoldierObj = fs.soldier;
    const selectable = selectableSoldierIds?.has(s.id) ?? false;
    const isSel = selectedSoldierIds?.has(s.id) ?? false;
    const canAct = canActSoldierIds?.has(s.id) ?? false;
    // Art size for this (possibly injured, smaller) soldier.
    const aw = SOLDIER_ART_WIDTH * fs.scale;
    const ah = SOLDIER_ART_HEIGHT * fs.scale;
    const { x, y } = fs;
    // Energy bolt marking a soldier that can still act: a small zigzag pinned
    // to the soldier's upper-right. Drawn above the sprite, non-interactive,
    // scaled with the art (injured soldiers get a smaller bolt).
    const bh = ah * ACTION_BOLT_H_FRAC;
    const bw = bh * ACTION_BOLT_W_FRAC;
    const bx = x + aw * ACTION_BOLT_X_OFF;
    const by = y - ah * ACTION_BOLT_Y_OFF;
    const boltPoints = [
      `${bx + bw * 0.3},${by - bh / 2}`,
      `${bx - bw * 0.35},${by + bh * 0.05}`,
      `${bx - bw * 0.05},${by + bh * 0.05}`,
      `${bx - bw * 0.3},${by + bh / 2}`,
      `${bx + bw * 0.35},${by - bh * 0.05}`,
      `${bx + bw * 0.05},${by - bh * 0.05}`,
    ].join(' ');
    // Selected-badge center: a gap above this soldier's head. The injured
    // sprite is shorter, so its badge sits further up from the center (a
    // different y offset than healthy soldiers).
    const badgeCy =
      y - ah / 2 - (s.injured ? CHECK_BADGE_Y_OFF_INJURED : CHECK_BADGE_Y_OFF) * SOLDIER_ART_HEIGHT;
    elements.push(
      <g
        key={`s-${s.id}`}
        style={{ cursor: onSoldierDragStart ? 'grab' : selectable && onSoldierClick ? 'pointer' : undefined }}
        onClick={selectable && onSoldierClick ? () => onSoldierClick(s.id) : undefined}
        // Drag any own soldier to move it (the hook re-validates the rules;
        // stopPropagation keeps the board from treating the press as a pan).
        onMouseDown={onSoldierDragStart ? (e) => onSoldierDragStart(e, army.ownerName, s.id) : undefined}
      >
        <svg
          x={x - aw / 2}
          y={y - ah / 2}
          width={aw}
          height={ah}
          style={{ color: playerColors?.[army.ownerName] ?? '#888' }}
          transform={army.flip ? `translate(${2 * x}, 0) scale(-1, 1)` : undefined}
        >
          <use
            href={s.injured ? '/art/injuredSoldier.svg#injured-soldier-shape' : '/art/soldier.svg#soldier-shape'}
            width={aw}
            height={ah}
          />
        </svg>
        {canAct && (
          <polygon
            points={boltPoints}
            fill={ACTION_BOLT_FILL}
            stroke={ACTION_BOLT_STROKE}
            strokeWidth={Math.max(1, fs.scale * 1.4)}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}
        {/* Selected-soldier check badge above the head, drawn last so it is
            never hidden by the sprite or the bolt. */}
        {isSel && (
          <g pointerEvents="none">
            <circle cx={x} cy={badgeCy} r={aw * CHECK_BADGE_R_FRAC} fill={CHECK_BADGE_COLOR} stroke="#fff" strokeWidth={Math.max(1, fs.scale)} />
            <path
              d={`M ${x - aw * CHECK_BADGE_R_FRAC * 0.5} ${badgeCy} l ${aw * CHECK_BADGE_R_FRAC * 0.3} ${aw * CHECK_BADGE_R_FRAC * 0.35} l ${aw * CHECK_BADGE_R_FRAC * 0.5} ${-aw * CHECK_BADGE_R_FRAC * 0.55}`}
              fill="none"
              stroke="#fff"
              strokeWidth={Math.max(1, aw * CHECK_BADGE_R_FRAC * 0.28)}
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
