import React from 'react';

interface StepperProps {
  value: number;
  /** Called with the decremented value (value - step). */
  onDecrement: () => void;
  /** Called with the incremented value (value + step). */
  onIncrement: () => void;
  /** Extra disable for − (e.g. value already at its floor). */
  canDecrement?: boolean;
  /** Extra disable for + (e.g. quota reached or supply empty). */
  canIncrement?: boolean;
  ariaDecrement?: string;
  ariaIncrement?: string;
  /** sm: inline counters (offer grids); lg: touch targets in prompts. */
  size?: 'sm' | 'lg';
  /** Replaces the numeric value display (e.g. the bank's "4 → 1" line). */
  children?: React.ReactNode;
}

const sizeClass = {
  sm: 'w-11 h-11 md:w-5 md:h-5 text-[16px] md:text-[12px]',
  lg: 'w-11 h-11 md:w-6 md:h-6 text-[18px] md:text-[14px]',
};

const btn =
  'flex items-center justify-center rounded-full border border-ink-faint/50 bg-canvas-raised font-bold text-ink-soft cursor-pointer transition-all hover:border-ink-soft hover:text-ink active:scale-90 motion-reduce:active:scale-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none';

/** Compact −/value/+ control. Used anywhere an amount is nudged: resource
 * counts in prompts, trade offer rows, bank-trade batch size. */
const Stepper: React.FC<StepperProps> = ({
  value,
  onDecrement,
  onIncrement,
  canDecrement = true,
  canIncrement = true,
  ariaDecrement = 'Less',
  ariaIncrement = 'More',
  size = 'lg',
  children,
}) => (
  <div className="flex items-center gap-1.5">
    <button
      type="button"
      onClick={onDecrement}
      disabled={!canDecrement || value <= 0}
      aria-label={ariaDecrement}
      className={`${btn} ${sizeClass[size]}`}
    >
      −
    </button>
    {children ?? (
      <span className={`text-center font-bold text-ink ${size === 'sm' ? 'w-4 text-[13px]' : 'w-5 text-sm'}`}>
        {value}
      </span>
    )}
    <button
      type="button"
      onClick={onIncrement}
      disabled={!canIncrement}
      aria-label={ariaIncrement}
      className={`${btn} ${sizeClass[size]}`}
    >
      +
    </button>
  </div>
);

export default Stepper;
