import React from 'react';
import { C } from '../../theme';

interface DiceProps {
  /** The die's value (1-6), or null when it hasn't been rolled yet. */
  value: number | null;
  /** The die's side length in px. */
  size: number;
  /** Whether this die can be clicked to roll it. */
  canRoll?: boolean;
  /** Called when the die is clicked (only when canRoll is true). */
  onRoll?: () => void;
  /** Round die: a white disc matching the corner gear button (last-roll stack). */
  circle?: boolean;
}

/** Pip positions on a 100x100 face (x, y) for each die value 1-6. */
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 28],
    [28, 50],
    [28, 72],
    [72, 28],
    [72, 50],
    [72, 72],
  ],
};

/** Radius of a pip on the 100x100 face. */
const PIP_RADIUS = 9;

/** A single die. Shows its value as pips (dots) or "?" when unrolled; clickable to roll. */
const Dice: React.FC<DiceProps> = ({ value, size, canRoll, onRoll, circle }) => (
  <button
    type="button"
    onClick={canRoll ? onRoll : undefined}
    className={`${circle ? 'rounded-full shadow-lg' : 'rounded-lg'} border-2 flex items-center justify-center font-bold text-ink ${
      canRoll
        ? 'border-gold bg-gold-pale cursor-pointer hover:bg-gold-soft/40 active:scale-90 transition-transform motion-reduce:active:scale-100'
        : 'border-ink-faint/50 bg-canvas-raised'
    }`}
    style={{ width: size, height: size }}
    title={canRoll ? 'Click to roll' : undefined}
    aria-label={canRoll ? 'Roll this die' : value === null ? 'Die not rolled yet' : `Die showing ${value}`}
  >
    {value === null ? (
      <span style={{ fontSize: size * 0.4 }}>?</span>
    ) : (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-label={`Die showing ${value}`}>
        {PIP_LAYOUTS[value].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={PIP_RADIUS} fill={C['board.dicePip']} />
        ))}
      </svg>
    )}
  </button>
);

export default Dice;
