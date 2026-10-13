import React from 'react';

interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Left icon — SVG node or emoji. */
  icon?: React.ReactNode;
  /** Right-side content (usually a count or badge). */
  trailing?: React.ReactNode;
  /** Emphasis: 'default' for neutral rows, 'accent' for the current player / active state. */
  tone?: 'default' | 'accent' | 'muted';
}

const toneClass = {
  default: 'bg-canvas-raised/80 border-ink-faint/30',
  accent: 'bg-gold-pale border-gold/50',
  muted: 'bg-canvas-sunken/60 border-ink-faint/20 opacity-60',
};

/** Compact info row — used by the players panel, turn chips, any dense list.
 * A pill: icon, label (truncates), right-side trailing content. */
const Chip: React.FC<ChipProps> = ({ icon, trailing, tone = 'default', className = '', children, ...rest }) => (
  <div
    className={`flex items-center gap-1.5 border rounded-full pl-1.5 pr-2.5 py-1 backdrop-blur-sm shadow-card ${toneClass[tone]} ${className}`}
    {...rest}
  >
    {icon && <span className="shrink-0 inline-flex">{icon}</span>}
    <span className="text-[13px] font-semibold text-ink truncate min-w-0">{children}</span>
    {trailing && <span className="ml-auto flex items-center gap-1.5 shrink-0 text-[12px]">{trailing}</span>}
  </div>
);

export default Chip;
