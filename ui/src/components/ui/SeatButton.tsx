import React from 'react';
import Button from './Button';

interface SeatButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  color?: string;
  /** Right-aligned status text ("offline · rejoin", "waiting…"). */
  status?: React.ReactNode;
}

/** A seat-pick row: player color dot, name, trailing status. Used by the
 * rejoin and paused-game pickers so both claim lists look the same. */
const SeatButton: React.FC<SeatButtonProps> = ({ color, status, children, className = '', ...rest }) => (
  <Button
    variant="unstyled"
    className={`flex items-center gap-3 px-3 py-2.5 rounded-md border-2 border-ink-faint/40 bg-canvas-raised text-left hover:border-gold hover:bg-gold-pale transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...rest}
  >
    <span className="w-5 h-5 rounded-full border-2 border-white shadow shrink-0" style={{ background: color }} />
    <span className="text-[15px] font-semibold text-ink">{children}</span>
    {status && <span className="ml-auto text-[12px] text-ink-faint">{status}</span>}
  </Button>
);

export default SeatButton;
