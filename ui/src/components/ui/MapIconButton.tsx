import React from 'react';

interface MapIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** lucide-react icon node (chrome glyph — never game-flavor emoji). */
  icon: React.ReactNode;
  /** Open/active state: blue ring + tinted face. */
  active?: boolean;
  /** Trade-style "you can act now" state: solid build-phase green face. */
  live?: boolean;
}

/**
 * The shared round map button (🔄 / ℹ️ / 💬 / 👤 column on the left edge):
 * 48px hit target, white face, scale-on-hover. Position it with `className`
 * (e.g. `absolute top-2 left-2`); overlays like count badges or side tags
 * are passed as absolutely-positioned children.
 */
const MapIconButton = React.forwardRef<HTMLButtonElement, MapIconButtonProps>(
  ({ icon, active = false, live = false, className = '', children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`absolute z-20 flex items-center justify-center w-12 h-12 rounded-full border-2 shadow-lg leading-none cursor-pointer hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 transition-transform ${
        live
          ? 'bg-phase-build border-phase-build text-white hover:bg-phase-build/80'
          : active
            ? 'bg-sky-pale border-sky text-ink ring-2 ring-sky-soft'
            : 'bg-canvas-raised border-ink-faint/50 text-ink-soft hover:border-sky'
      } ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
);
MapIconButton.displayName = 'MapIconButton';
export default MapIconButton;
