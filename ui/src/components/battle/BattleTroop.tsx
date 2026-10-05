import React from 'react';
import { BattlePhase } from 'common';
import { TroopSlot } from '../../types/battleModal';
import { effDead, effInjured, FALLBACK_OWNER_COLOR } from '../../utils/battleModal';
import { TROOP_R } from '../../constants';
import {
  DEAD_TROOP_OPACITY,
  INJURED_TROOP_SCALE,
  ROBBER_ART,
  SOLDIER_FIGURE_WIDTH_FRAC,
  SOLDIER_ICON_HEIGHT,
  SOLDIER_ICON_LIFT,
  SOLDIER_ICON_WIDTH,
  TROOP_LABEL_OUTLINE,
  TROOP_LABEL_OUTLINE_WIDTH,
  TROOP_LABEL_SIZE,
  TROOP_ROLL_BADGE_FILL,
  TROOP_ROLL_BADGE_R,
  TROOP_ROLL_LABEL_SIZE,
} from './constants';

interface BattleTroopProps {
  slot: TroopSlot;
  /** The clash-line center x — troops left of it face the other way. */
  centerX: number;
  phase: BattlePhase;
  /** True while this troop is mine to roll (shows the 🎲 label, clickable). */
  mine: boolean;
  /** True while this troop's roll is in flight (clicked, awaiting the result). */
  rolling: boolean;
  colors: Record<string, string>;
  onRoll: (soldierId: string) => void;
}

/** One troop (icon + die value), clickable if it is mine to roll. */
export const BattleTroop: React.FC<BattleTroopProps> = ({
  slot,
  centerX,
  phase,
  mine,
  rolling,
  colors,
  onRoll,
}) => {
  const { x, y, s } = slot;
  // During 'betweenRounds', this round's casualties are not shown yet — the
  // troop keeps its healthy look and die until "continue battle" is clicked.
  const dead = effDead(s, phase);
  const injured = effInjured(s, phase);
  const opacity = dead ? DEAD_TROOP_OPACITY : 1;
  const scale = injured ? INJURED_TROOP_SCALE : 1;
  const isRobber = s.soldier.owner === 'Robber';
  let label: React.ReactNode = '·';
  let labelSize = TROOP_LABEL_SIZE;
  if (dead) {
    label = '×';
  } else if (rolling) {
    // The roll is in flight — show a pending marker instead of a stale cue.
    label = '…';
  } else if (s.rollNum !== null) {
    label = s.rollNum;
    labelSize = TROOP_ROLL_LABEL_SIZE;
  } else if (mine) {
    label = '🎲';
  }
  // Both troops share one figure box, centered on (x, y): the soldier art's
  // drawn figure. The robber is scaled so its figure matches that height.
  const figH = TROOP_R * SOLDIER_ICON_HEIGHT * scale;
  const figTop = y - TROOP_R * SOLDIER_ICON_LIFT * scale;
  const figW = isRobber
    ? (figH * ROBBER_ART.w) / ROBBER_ART.h
    : TROOP_R * SOLDIER_ICON_WIDTH * SOLDIER_FIGURE_WIDTH_FRAC * scale;
  // The robber image is the whole canvas; place it so its figure lands in the box.
  const robberScale = figH / ROBBER_ART.h;
  return (
    <g
      opacity={opacity}
      style={{ cursor: mine ? 'pointer' : undefined }}
      onClick={mine ? () => onRoll(s.soldier.id) : undefined}
    >
      {/* Click target: the figure itself (plus a little margin), so a click
          anywhere on the troop rolls — not just its label or art strokes. */}
      {mine && (
        <rect
          x={x - figW / 2 - 4}
          y={figTop - 4}
          width={figW + 8}
          height={figH + 8}
          rx={6}
          fill="transparent"
          pointerEvents="all"
        />
      )}
      {isRobber ? (
        /* Robber icon (the full character art, untinted). */
        <image
          href="/art/robber.png"
          x={x - figW / 2 - ROBBER_ART.x * robberScale}
          y={figTop - ROBBER_ART.y * robberScale}
          width={ROBBER_ART.canvasW * robberScale}
          height={ROBBER_ART.canvasH * robberScale}
          pointerEvents="none"
        />
      ) : (
        /* Soldier icon (red part tinted to the owner's color); injured uses the injured icon. */
        <svg
          x={x - TROOP_R * scale}
          y={figTop}
          width={TROOP_R * SOLDIER_ICON_WIDTH * scale}
          height={figH}
          style={{ color: colors[s.soldier.owner] ?? FALLBACK_OWNER_COLOR }}
          pointerEvents="none"
        >
          <use
            href={injured ? '/art/injuredSoldier.svg#injured-soldier-shape' : '/art/soldier.svg#soldier-shape'}
            width={TROOP_R * SOLDIER_ICON_WIDTH * scale}
            height={figH}
            transform={x < centerX ? `translate(${TROOP_R * SOLDIER_ICON_WIDTH * scale}, 0) scale(-1, 1)` : undefined}
          />
        </svg>
      )}
      {/* Dark disc behind a rolled number so it reads on any owner color. */}
      {!dead && !rolling && s.rollNum !== null && (
        <circle
          cx={x}
          cy={y}
          r={TROOP_ROLL_LABEL_SIZE * TROOP_ROLL_BADGE_R}
          fill={TROOP_ROLL_BADGE_FILL}
          pointerEvents="none"
        />
      )}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        // Dark outline painted under the fill: legible on light or dark art.
        stroke={TROOP_LABEL_OUTLINE}
        strokeWidth={TROOP_LABEL_OUTLINE_WIDTH}
        strokeLinejoin="round"
        paintOrder="stroke"
        fontSize={labelSize}
        fontWeight="bold"
        // The click target above takes the clicks.
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
};
