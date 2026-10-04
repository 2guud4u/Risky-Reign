import React from 'react';
import { BattlePhase, PixelCoord, SoldierBattleState } from 'common';
import { TroopSlot } from '../../types/battleModal';
import { BattleTroop } from './BattleTroop';

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
 * line plus the attacker's army (left) and the defender's army (right).
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
}) => (
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
  </>
);
