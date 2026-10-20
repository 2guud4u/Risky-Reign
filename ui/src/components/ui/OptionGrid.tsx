import React from 'react';
import GameIcon, { IconName } from './GameIcon';

export interface OptionItem<K extends string | number = string | number> {
  key: K;
  title: React.ReactNode;
  /** Left/above icon — a GameIcon name or any node (player dot, sprite). */
  icon?: IconName | React.ReactNode;
  sub?: React.ReactNode;
  /** Small trailing chip (e.g. a victim's card count). */
  badge?: React.ReactNode;
  disabled?: boolean;
}

interface OptionGridProps<K extends string | number = string | number> {
  options: OptionItem<K>[];
  onPick: (key: K) => void;
  /** Selected key → chip gets the active outline. */
  selected?: K | null;
  /** card: big vertical choice cards (knight effects, seat claims).
   *  chip: compact horizontal pick rows (victims, trade targets). */
  layout?: 'card' | 'chip';
  className?: string;
}

const isIconName = (x: unknown): x is IconName => typeof x === 'string';

/** A pick-one row/grid: choice cards, victim chips, trade targets, seat
 * claims. Selection styling lives here so every picker looks the same. */
function OptionGrid<K extends string | number>({
  options,
  onPick,
  selected = null,
  layout = 'chip',
  className,
}: OptionGridProps<K>) {
  const wrap = className ?? (layout === 'card' ? 'flex gap-3' : 'flex flex-wrap gap-2');
  return (
    <div className={wrap}>
      {options.map((o) => {
        const active = selected === o.key;
        const icon =
          o.icon === undefined ? null : isIconName(o.icon) ? (
            <GameIcon name={o.icon} size={layout === 'card' ? 32 : 14} />
          ) : (
            o.icon
          );
        if (layout === 'card') {
          return (
            <button
              key={String(o.key)}
              type="button"
              disabled={o.disabled}
              onClick={() => onPick(o.key)}
              className={`flex-1 py-4 rounded-md border-2 flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed ${
                active
                  ? 'border-sky bg-sky-pale'
                  : 'border-ink-faint/40 bg-canvas-raised hover:border-sky hover:bg-sky-pale'
              }`}
            >
              {icon}
              <span className="text-sm font-semibold text-ink">{o.title}</span>
              {o.sub && <span className="text-[11px] text-ink-faint">{o.sub}</span>}
            </button>
          );
        }
        return (
          <button
            key={String(o.key)}
            type="button"
            disabled={o.disabled}
            aria-pressed={active}
            onClick={() => onPick(o.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-semibold cursor-pointer transition-all active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed ${
              active
                ? 'border-sky bg-sky text-white shadow-card'
                : 'border-ink-faint/40 bg-canvas-raised text-ink-soft hover:border-ink-soft'
            }`}
          >
            {icon}
            {o.title}
            {o.sub && (
              <span className={`text-[11px] font-normal ${active ? 'text-sky-pale' : 'text-ink-faint'}`}>
                {o.sub}
              </span>
            )}
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}

export default OptionGrid;
