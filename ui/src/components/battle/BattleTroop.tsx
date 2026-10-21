import React from 'react';
import { BattlePhase } from 'common';
import { TroopSlot } from '../../types/battleModal';
import { effDead, FALLBACK_OWNER_COLOR } from '../../utils/battleModal';
import { TROOP_ART, TROOP_R } from '../../constants';
import { GAME_ICONS } from '../ui/GameIcon';
import { TintedSprite } from '../TintedSprite';
import { TROOP_SPRITES } from '../../utils/tintedArt';
import { troopArtKind } from '../../utils/garrisonFormation';
import {
  DEAD_TROOP_OPACITY,
  ROBBER_ART,
  SOLDIER_ICON_HEIGHT,
  SOLDIER_ICON_LIFT,
  TROOP_LABEL_OUTLINE,
  TROOP_LABEL_OUTLINE_WIDTH,
  TROOP_LABEL_SIZE,
  TROOP_ROLL_BADGE_FILL,
  TROOP_ROLL_BADGE_R,
  TROOP_ROLL_LABEL_SIZE,
} from './constants';

/** Dice glyph on a troop that's mine to roll (replaces the old  label). */
const DiceIcon = GAME_ICONS.dice;

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
  // During 'betweenRounds', this round's DEAD casualties stay healthy-looking
  // until "continue battle" — but a newly-injured troop keeps its injured
  // pose right away (it "stays in injured form" after the fight replay).
  const dead = effDead(s, phase);
  const injured = s.injured;
  const opacity = dead ? DEAD_TROOP_OPACITY : 1;
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
    label = '';
  }
  // Both troops share one figure box, centered on (x, y): the soldier art's
  // drawn figure. The robber is scaled so its figure matches that height.
  const figH = TROOP_R * SOLDIER_ICON_HEIGHT;
  const figTop = y - TROOP_R * SOLDIER_ICON_LIFT;
  const feetY = figTop + figH;
  // Every troop sprite keeps the board's people-matched size ratio, scaled so
  // a healthy soldier fills the figure height; injured and cannon troops
  // stand on the same feet line.
  const art = troopArtKind({ ...s.soldier, injured });
  const artScale = figH / TROOP_ART.soldier.h;
  const artW = TROOP_ART[art].w * artScale;
  const artH = TROOP_ART[art].h * artScale;
  const figW = isRobber ? (figH * ROBBER_ART.w) / ROBBER_ART.h : artW;
  const boxTop = isRobber ? figTop : feetY - artH;
  const boxH = isRobber ? figH : artH;
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
          y={boxTop - 4}
          width={figW + 8}
          height={boxH + 8}
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
        /* Troop art (armor tinted to the owner's color), at the same
           people-matched ratio as the board: injured, cannon and soldier
           sprites stand on one ground line. */
        <TintedSprite
          art={TROOP_SPRITES[art]}
          color={colors[s.soldier.owner] ?? FALLBACK_OWNER_COLOR}
          x={x - artW / 2}
          y={feetY - artH}
          width={artW}
          height={artH}
          transform={x < centerX ? `translate(${2 * x}, 0) scale(-1, 1)` : undefined}
        />
      )}
      {/* Dark disc behind a rolled number (or the roll cue) so it reads on any owner color. */}
      {!dead && !rolling && (s.rollNum !== null || mine) && (
        <circle
          cx={x}
          cy={y}
          r={TROOP_ROLL_LABEL_SIZE * TROOP_ROLL_BADGE_R}
          fill={TROOP_ROLL_BADGE_FILL}
          pointerEvents="none"
        />
      )}
      {!dead && !rolling && s.rollNum === null && mine && (
        <DiceIcon
          x={x - TROOP_ROLL_LABEL_SIZE * 0.7}
          y={y - TROOP_ROLL_LABEL_SIZE * 0.7}
          width={TROOP_ROLL_LABEL_SIZE * 1.4}
          height={TROOP_ROLL_LABEL_SIZE * 1.4}
          color="#fff"
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
