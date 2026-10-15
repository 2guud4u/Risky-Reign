import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Bandage,
  Castle,
  Check,
  CircleHelp,
  Coins,
  CornerUpLeft,
  Crown,
  Dices,
  Eye,
  Flag,
  Footprints,
  Ghost,
  Gift,
  Globe,
  Hammer,
  Hand,
  Home,
  Landmark,
  Layers2,
  Lightbulb,
  Lock,
  LogOut,
  Logs,
  Medal,
  Megaphone,
  MessageCircle,
  Mountain,
  Palette,
  Pickaxe,
  Pointer,
  Receipt,
  Route,
  Ship,
  Star,
  Swords,
  Shield,
  Skull,
  Target,
  Trash2,
  Trophy,
  User,
  Users,
  VenetianMask,
  Wheat,
  X,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';


/**
 * Every game-flavor glyph, keyed by a short semantic name. Lucide icons cover
 * most glyphs; icons lucide doesn't have (sheep, brick) are drawn below in
 * the same 24x24 / 2px-stroke / round-cap style so the set reads as one.
 */
export type IconName = keyof typeof GAME_ICONS;

/** Lucide-style stroke props shared by the custom glyphs. */
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** 🐑 Sheep — no lucide equivalent. Profile: woolly body, head, two legs. */
const SheepIcon: LucideIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...strokeProps}
      {...props}
    >
      {/* body: bumpy wool silhouette */}
      <path d="M7.5 8a2.5 2.5 0 0 1 2-2.45A2.5 2.5 0 0 1 12 4.5a2.5 2.5 0 0 1 2.5 1.05A2.5 2.5 0 0 1 16.5 8a2.5 2.5 0 0 1 .5 4.95 2.5 2.5 0 0 1-2 4.05H9a2.5 2.5 0 0 1-2-4.05A2.5 2.5 0 0 1 7.5 8Z" />
      {/* head */}
      <path d="M15 9.5c1.8-.6 3.5.4 3.5 2.2 0 1.6-1.4 2.8-3 2.8" />
      <circle cx="17.4" cy="11.3" r="0.4" fill="currentColor" stroke="none" />
      {/* legs */}
      <path d="M9 17v3M13.5 17v3" />
    </svg>
  )
);
SheepIcon.displayName = 'SheepIcon';

/** 🧱 Brick — a fired-brick face with mortar grooves (not a full wall). */
const BrickIcon: LucideIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...strokeProps}
      {...props}
    >
      <rect x="3" y="7" width="18" height="10" rx="1" />
      <path d="M3 12h18M12 7v5M7.5 12v5M16.5 12v5" />
    </svg>
  )
);
BrickIcon.displayName = 'BrickIcon';

/**
 * Name → glyph. Keys read as what the thing IS (a settlement, an attack),
 * not how the emoji looked, so call sites stay meaningful when art changes.
 */
export const GAME_ICONS = {
  // resources
  wood: Logs,
  brick: BrickIcon,
  sheep: SheepIcon,
  wheat: Wheat,
  ore: Mountain,
  // buildings + soldier actions
  settlement: Home,
  city: Castle,
  road: Route,
  recruit: Hand,
  move: Footprints,
  heal: Bandage,
  attack: Swords,
  capture: Flag,
  retreat: CornerUpLeft,
  // robber + cards
  robber: VenetianMask,
  cards: Layers2,
  knight: Shield,
  gift: Gift,
  coins: Coins,
  // meta / notices
  dice: Dices,
  trophy: Trophy,
  star: Star,
  crown: Crown,
  skull: Skull,
  ghost: Ghost,
  target: Target,
  pointer: Pointer,
  warning: AlertTriangle,
  question: CircleHelp,
  // trade / board chrome + misc
  ship: Ship,
  bank: Landmark,
  megaphone: Megaphone,
  globe: Globe,
  chat: MessageCircle,
  trade: ArrowRightLeft,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  bulb: Lightbulb,
  lock: Lock,
  bolt: Zap,
  eye: Eye,
  medal: Medal,
  receipt: Receipt,
  user: User,
  users: Users,
  pickaxe: Pickaxe,
  palette: Palette,
  trash: Trash2,
  leave: LogOut,
  build: Hammer,
  check: Check,
  x: X,
} as const satisfies Record<string, LucideIcon>;

/**
 * Painted art for the five resources (generated, alpha-cut, in /art/icons).
 * Overrides the GAME_ICONS glyph wherever the icon renders in HTML; SVG-only
 * surfaces (port medallions) use this map via <image>. The lucide entries stay
 * registered as the fallback + keep IconName keys stable.
 */
export const RESOURCE_ART = {
  wood: '/art/icons/wood.png',
  brick: '/art/icons/brick.png',
  sheep: '/art/icons/sheep.png',
  wheat: '/art/icons/wheat.png',
  ore: '/art/icons/ore.png',
  ship: '/art/icons/ship.png',
} as const satisfies Partial<Record<IconName, string>>;

export interface GameIconProps extends Omit<LucideProps, 'size' | 'name'> {
  /** Registry key (e.g. 'settlement', 'sheep'). */
  name: IconName;
  /** Icon box in px (same meaning as lucide's `size`). */
  size?: number;
  /** Passed through for screen readers; icons are decorative by default. */
  'aria-label'?: string;
}

/**
 * Renders one game glyph. Drop-in wherever an emoji used to sit: the icon
 * inherits `currentColor`, so it takes its color from surrounding text.
 */
const GameIcon: React.FC<GameIconProps> = ({ name, size = 16, className, ...rest }) => {
  const art = RESOURCE_ART[name as keyof typeof RESOURCE_ART];
  if (art) {
    return (
      <img
        src={art}
        width={size}
        height={size}
        alt={rest['aria-label'] ?? ''}
        aria-hidden={rest['aria-label'] ? undefined : true}
        className={className}
        draggable={false}
      />
    );
  }
  const Icon = GAME_ICONS[name];
  return (
    <Icon
      size={size}
      className={className}
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    />
  );
};

export default GameIcon;
