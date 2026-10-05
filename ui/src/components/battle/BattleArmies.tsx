import React from 'react';
import { BattlePhase, PixelCoord, SoldierBattleState } from 'common';
import { TroopSlot } from '../../types/battleModal';
import { TROOP_R } from '../../constants';
import { BattleTroop } from './BattleTroop';
import {
  INJURED_TROOP_SCALE,
  ROLL_FINGER_GAP,
  ROLL_FINGER_SIZE,
  SOLDIER_FIGURE_WIDTH_FRAC,
  SOLDIER_ICON_WIDTH,
} from './constants';

interface BattleArmiesProps {
  /** The battle vertex's mini-map position. */
  center: PixelCoord;
  phase: BattlePhase;
  attackerSlots: TroopSlot[];
  defenderSlots: TroopSlot[];
  /** Pixel height of the dashed center clash line. */
  troopSpread: number;
  canRoll: (s: SoldierBattleState) => boolean;
  /** The troop whose roll is in flight (clicked, awaiting the result). */
  rollingSoldierId: string | null;
  colors: Record<string, string>;
  onRoll: (soldierId: string) => void;
}

/**
 * The fighting view drawn over the battle mini-map: the dashed center clash
 * line plus the attacker's army (left) and the defender's army (right). A
 * single bobbing finger points at the next troop the viewer must click to
 * roll, from its outer side, hopping to the next one as each roll lands.
 */
export const BattleArmies: React.FC<BattleArmiesProps> = ({
  center,
  phase,
  attackerSlots,
  defenderSlots,
  troopSpread,
  canRoll,
  rollingSoldierId,
  colors,
  onRoll,
}) => {
  // canRoll covers dead/rolled troops and turn ownership; skip the in-flight one.
  const next = [...attackerSlots, ...defenderSlots].find(
    (slot) => canRoll(slot.s) && slot.s.soldier.id !== rollingSoldierId
  );
  // Attackers stand left of the clash line, so their open side is the left.
  const fromLeft = !!next && next.x < center.x;
  const halfFigW = next
    ? (TROOP_R * SOLDIER_ICON_WIDTH * SOLDIER_FIGURE_WIDTH_FRAC * (next.s.injured ? INJURED_TROOP_SCALE : 1)) / 2
    : 0;
  return (
    <>
      {/* Center clash line. */}
      <line
        x1={center.x}
        y1={center.y - troopSpread / 2}
        x2={center.x}
        y2={center.y + troopSpread / 2}
        stroke="#dc2626"
        strokeWidth={2}
        strokeDasharray="6 5"
        opacity={0.6}
      />
      {/* Attacker's army (left) and defender's army (right). */}
      {attackerSlots.map((slot, i) => (
        <BattleTroop
          key={`a-${i}`}
          slot={slot}
          centerX={center.x}
          phase={phase}
          mine={canRoll(slot.s)}
          rolling={slot.s.soldier.id === rollingSoldierId}
          colors={colors}
          onRoll={onRoll}
        />
      ))}
      {defenderSlots.map((slot, i) => (
        <BattleTroop
          key={`d-${i}`}
          slot={slot}
          centerX={center.x}
          phase={phase}
          mine={canRoll(slot.s)}
          rolling={slot.s.soldier.id === rollingSoldierId}
          colors={colors}
          onRoll={onRoll}
        />
      ))}
      {/* "Click here to roll": drawn last so it sits over every troop. Keyed
          by soldier so the bob restarts on each hop; ignores the mouse so the
          click still lands on the troop beside it. */}
      {next && (
        <text
          key={next.s.soldier.id}
          x={next.x + (fromLeft ? -1 : 1) * (halfFigW + ROLL_FINGER_GAP)}
          y={next.y}
          textAnchor={fromLeft ? 'end' : 'start'}
          dominantBaseline="central"
          fontSize={ROLL_FINGER_SIZE}
          pointerEvents="none"
          className={`pointer-finger-side select-none ${fromLeft ? '' : 'pointer-finger-side-left'}`}
          style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.45))' }}
        >
          {fromLeft ? '👉' : '👈'}
        </text>
      )}
    </>
  );
};
