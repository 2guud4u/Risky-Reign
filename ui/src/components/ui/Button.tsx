import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon' | 'outline' | 'unstyled';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-gold text-ink font-bold hover:bg-gold-soft active:bg-gold-deep active:text-white shadow-card',
  secondary:
    'bg-canvas-raised text-ink border border-ink-faint/40 hover:bg-canvas-sunken font-semibold shadow-card',
  danger:
    'bg-clay text-white font-bold hover:bg-clay-soft shadow-card',
  ghost:
    'bg-transparent text-ink-soft hover:bg-canvas-sunken font-semibold',
  icon:
    'bg-canvas-raised text-ink-soft border border-ink-faint/40 hover:bg-canvas-sunken shadow-card',
  // Sky-outline action — the "Assign …" / confirm-less action in palettes.
  outline:
    'bg-sky-pale text-sky border border-sky font-semibold hover:bg-sky-soft/40',
  // No chrome at all — for wrappers around rich content (dice, card faces,
  // drag chips) that style themselves.
  unstyled: '',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-[12px] rounded-md',
  md: 'px-3.5 py-2 text-[14px] rounded-md',
  lg: 'px-5 py-3 text-[16px] rounded-lg',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Icon to render left of children (lucide-react node). */
  icon?: React.ReactNode;
}

/** Shared button. All screens render through this — never raw <button> with
 * ad-hoc classes. Variant picks the role (primary/danger/ghost/icon), size
 * picks the scale. */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 transition-all duration-fast cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${variantClass[variant]} ${variant === 'unstyled' ? '' : sizeClass[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
export default Button;
