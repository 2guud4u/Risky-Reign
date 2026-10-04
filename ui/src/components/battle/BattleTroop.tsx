import React from 'react';
import { BattlePhase } from 'common';
import { TroopSlot } from '../../types/battleModal';
import { effDead, effInjured, FALLBACK_OWNER_COLOR } from '../../utils/battleModal';
import { TROOP_R, ROBBER_BATTLE_W, ROBBER_BATTLE_H } from '../../constants';
import {
  DEAD_TROOP_OPACITY,
  INJURED_TROOP_SCALE,
  ROBBER_ICON_LIFT,
  SOLDIER_ICON_HEIGHT,
  SOLDIER_ICON_LIFT,
  SOLDIER_ICON_WIDTH,
  TROOP_LABEL_SIZE,
  TROOP_ROLL_LABEL_SIZE,
} from './constants';

interface BattleTroopProps {
  slot: TroopSlot;
  /** The clash-line center x — troops left of it face the other way. */
  centerX: number;
  phase: BattlePhase;
  /** True while this troop is mine to roll (shows the 🎲 cue, clickable). */
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
  return (
    <g
      opacity={opacity}
      style={{ cursor: mine ? 'pointer' : undefined }}
      onClick={mine ? () => onRoll(s.soldier.id) : undefined}
    >
      {/* Pulsing ring: the only thing that tells the player "click me to
          roll" — without it the roll cue is easy to miss. */}
      {mine && !dead && s.rollNum === null && (
        <circle
          cx={x}
          cy={y}
          r={TROOP_R + 4}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={3}
          className="blink-circle"
        />
      )}
      {isRobber ? (
        /* Robber icon (the full character art, untinted). */
        <image
          href="/art/robber.png"
          x={x - (TROOP_R * ROBBER_BATTLE_W * scale) / 2}
          y={y - TROOP_R * ROBBER_ICON_LIFT * scale}
          width={TROOP_R * ROBBER_BATTLE_W * scale}
          height={TROOP_R * ROBBER_BATTLE_H * scale}
          preserveAspectRatio="xMidYMax meet"
        />
      ) : (
        /* Soldier icon (red part tinted to the owner's color); injured uses the injured icon. */
        <svg
          x={x - TROOP_R * scale}
          y={y - TROOP_R * SOLDIER_ICON_LIFT * scale}
          width={TROOP_R * SOLDIER_ICON_WIDTH * scale}
          height={TROOP_R * SOLDIER_ICON_HEIGHT * scale}
          style={{ color: colors[s.soldier.owner] ?? FALLBACK_OWNER_COLOR }}
        >
          <use
            href={injured ? '/art/injuredSoldier.svg#injured-soldier-shape' : '/art/soldier.svg#soldier-shape'}
            width={TROOP_R * SOLDIER_ICON_WIDTH * scale}
            height={TROOP_R * SOLDIER_ICON_HEIGHT * scale}
            transform={x < centerX ? `translate(${TROOP_R * SOLDIER_ICON_WIDTH * scale}, 0) scale(-1, 1)` : undefined}
          />
        </svg>
      )}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={labelSize}
        fontWeight="bold"
        // Hit the whole dice label, not just the soldier art behind it.
        pointerEvents={mine ? 'all' : 'none'}
      >
        {label}
      </text>
    </g>
  );
};
