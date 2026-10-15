import React from 'react';

interface MapIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** lucide-react icon node (chrome glyph — never game-flavor emoji). */
  icon: React.ReactNode;
  /** Open/active state: blue ring + tinted face. */
  active?: boolean;
  /** Trade-style "you can act now" state: solid green face. */
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
          ? 'bg-green-500 border-green-700 text-white hover:bg-green-400'
          : active
            ? 'bg-blue-100 border-blue-600 text-gray-800 ring-2 ring-blue-300'
            : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'
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
