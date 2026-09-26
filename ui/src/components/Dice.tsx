import React from 'react';

interface DiceProps {
  /** The die's value (1-6), or null when it hasn't been rolled yet. */
  value: number | null;
  /** The die's side length in px. */
  size: number;
  /** Whether this die can be clicked to roll it. */
  canRoll?: boolean;
  /** Called when the die is clicked (only when canRoll is true). */
  onRoll?: () => void;
}

/** A single die. Shows its value (or "?" when unrolled); clickable to roll. */
const Dice: React.FC<DiceProps> = ({ value, size, canRoll, onRoll }) => (
  <button
    type="button"
    onClick={canRoll ? onRoll : undefined}
    className={`rounded-lg border-2 flex items-center justify-center font-bold text-gray-800 ${
      canRoll
        ? 'border-amber-500 bg-amber-50 cursor-pointer hover:bg-amber-100'
        : 'border-gray-300 bg-white'
    }`}
    style={{ width: size, height: size, fontSize: size * 0.4 }}
    title={canRoll ? 'Click to roll' : undefined}
  >
    {value ?? '?'}
  </button>
);

export default Dice;
