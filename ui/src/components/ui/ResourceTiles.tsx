import React from 'react';
import { RESOURCES, ResourceKey } from 'common';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';
import GameIcon from './GameIcon';
import Stepper from './Stepper';

/** Accent for the "this tile is picked" state — matches the action's tone. */
export type TileAccent = 'gold' | 'sky' | 'clay';

const ACCENT: Record<TileAccent, { active: string; hover: string; text: string }> = {
  gold: {
    active: 'border-gold bg-gold-pale',
    hover: 'hover:border-gold hover:bg-gold-pale',
    text: 'text-gold-deep',
  },
  sky: {
    active: 'border-sky bg-sky-pale',
    hover: 'hover:border-sky hover:bg-sky-pale',
    text: 'text-sky',
  },
  clay: {
    active: 'border-clay bg-clay-pale',
    hover: 'hover:border-clay hover:bg-clay-pale',
    text: 'text-clay',
  },
};

interface ResourceTilesProps {
  /** Selected state per resource: a tile counts as active when > 0 (stepper
   *  mode) or === its picked key (pick mode via `picked`). */
  counts?: Partial<Record<ResourceKey, number>>;
  /** Pick mode: the currently selected resource (one-of). When set,
   *  `onPick(resource)` fires on tile click and no steppers render. */
  picked?: ResourceKey | null;
  onPick?: (r: ResourceKey) => void;
  /** Stepper mode: per-resource +/− callbacks (Max passes delta > 1).
   *  `canAdd` lets the caller cap the + (quota, hand size, bank supply);
   *  − is disabled at 0. */
  onStep?: (r: ResourceKey, delta: number) => void;
  canAdd?: (r: ResourceKey) => boolean;
  /** Small line under the name ("have 4", "bank 12"). */
  sub?: (r: ResourceKey) => React.ReactNode;
  /** Pill shown under `sub` (e.g. a port's "3:1" rate). */
  badge?: (r: ResourceKey) => React.ReactNode;
  /** "+N" affordance under the stepper (Discard's "Max"): return the delta
   *  to add, or null/undefined to hide it for that tile. */
  maxFor?: (r: ResourceKey) => number | null | undefined;
  accent?: TileAccent;
  iconSize?: number;
  /** Grid container classes — callers pick the column count. */
  gridClassName?: string;
}

/** The one tile grid for resources: pick-one tiles (Monopoly, bank trade) or
 * per-resource steppers (discard, Year of Plenty). Callers never render the
 * five-icon × count grid by hand. */
const ResourceTiles: React.FC<ResourceTilesProps> = ({
  counts = {},
  picked = null,
  onPick,
  onStep,
  canAdd,
  sub,
  badge,
  maxFor,
  accent = 'sky',
  iconSize = 30,
  gridClassName = 'grid grid-cols-3 min-[480px]:grid-cols-5 gap-2',
}) => {
  const a = ACCENT[accent];
  return (
    <div className={gridClassName}>
      {RESOURCES.map((r) => {
        const count = counts[r] ?? 0;
        const active = onPick ? picked === r : count > 0;
        const face = (
          <>
            <GameIcon name={RESOURCE_ICONS[r]} size={iconSize} />
            <span className="text-[12px] font-semibold text-ink-soft">{r}</span>
            {sub && <span className="text-[11px] text-ink-faint">{sub(r)}</span>}
            {badge && badge(r)}
          </>
        );
        if (onPick) {
          return (
            <button
              key={r}
              type="button"
              onClick={() => onPick(r)}
              title={r}
              className={`py-2 rounded-md border-2 flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 motion-reduce:active:scale-100 ${
                active ? a.active : `border-ink-faint/40 bg-canvas-raised ${a.hover}`
              }`}
            >
              {face}
            </button>
          );
        }
        return (
          <div
            key={r}
            className={`py-2 rounded-md border-2 flex flex-col items-center gap-1 ${
              active ? a.active : 'border-ink-faint/40 bg-canvas-raised'
            }`}
          >
            {face}
            {onStep && (
              <Stepper
                value={count}
                onDecrement={() => onStep(r, -1)}
                onIncrement={() => onStep(r, 1)}
                canIncrement={canAdd ? canAdd(r) : true}
                ariaDecrement={`One less ${r}`}
                ariaIncrement={`One more ${r}`}
              />
            )}
            {(() => {
              const delta = maxFor?.(r);
              return delta != null && delta > 0 ? (
                <button
                  type="button"
                  onClick={() => onStep?.(r, delta)}
                  disabled={!(canAdd ? canAdd(r) : true)}
                  className={`text-[11px] font-semibold ${a.text} hover:opacity-80 disabled:text-ink-faint disabled:cursor-not-allowed cursor-pointer`}
                >
                  Max
                </button>
              ) : null;
            })()}
          </div>
        );
      })}
    </div>
  );
};

export default ResourceTiles;
