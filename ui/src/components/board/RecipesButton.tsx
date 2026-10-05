import React, { useEffect, useState } from 'react';
import {
  BONUS_VP,
  CityPrice,
  DevelopmentCardPrice,
  HealSoldierAmount,
  HealSoldierResources,
  LARGEST_ARMY_MIN,
  LONGEST_ROAD_MIN,
  Price,
  RESOURCES,
  RoadPrice,
  SettlementPrice,
  SoldierPrice,
  WARMONGER_MIN,
  WIN_VP,
} from 'common';
import { RESOURCE_ICONS } from '../../utils/resourceIcons';
import { backdropClass, modalCardClass } from '../../styles';

/** One build recipe: what it is, what it costs, and what it gets you. */
interface Recipe {
  icon: string;
  name: string;
  /** Fixed cost; omitted for recipes with a choice of payment (healing). */
  price?: Price;
  /** Free-form cost line for recipes `price` can't express. */
  costText?: string;
  note: string;
}

/** Every recipe, read from the shared `common` price constants. */
const RECIPES: Recipe[] = [
  { icon: '🛤️', name: 'Road', price: RoadPrice, note: 'Connects your settlements; counts toward Longest Road.' },
  { icon: '🏠', name: 'Settlement', price: SettlementPrice, note: '1 VP. Collects resources from adjacent hexes.' },
  { icon: '🏰', name: 'City', price: CityPrice, note: 'Upgrade a settlement. 2 VP; collects double resources.' },
  { icon: '⚔️', name: 'Soldier', price: SoldierPrice, note: 'Garrisons a vertex; fights battles and the robber.' },
  {
    icon: '🩹',
    name: 'Heal soldier',
    costText: HealSoldierResources.map((r) => `${HealSoldierAmount} ${RESOURCE_ICONS[r]}`).join(' or '),
    note: 'Restores one injured soldier.',
  },
  { icon: '🎴', name: 'Development card', price: DevelopmentCardPrice, note: 'Draw a random development card.' },
];

/**
 * Every way to earn victory points, read from the shared scoring constants
 * (see `applyBonuses`). Bonuses have one holder; a tie keeps the current one.
 */
const ACHIEVEMENTS: { icon: string; name: string; vp: number; note: string }[] = [
  { icon: '🏠', name: 'Settlement', vp: 1, note: 'Each settlement you own.' },
  { icon: '🏰', name: 'City', vp: 2, note: 'Each city you own.' },
  { icon: '⭐', name: 'Victory Point card', vp: 1, note: 'Counted as soon as you draw it.' },
  { icon: '🛤️', name: 'Longest Road', vp: BONUS_VP, note: `Longest unbroken road chain, at least ${LONGEST_ROAD_MIN} roads.` },
  { icon: '🛡️', name: 'Largest Army', vp: BONUS_VP, note: `Most soldiers on the board, at least ${LARGEST_ARMY_MIN}.` },
  { icon: '🏆', name: 'Warmonger', vp: BONUS_VP, note: `Most battles won against players, at least ${WARMONGER_MIN}.` },
];

/** The cost as one icon chip per card (e.g. 🌾 🌾 🪨 🪨 🪨). */
const CostChips: React.FC<{ price: Price }> = ({ price }) => (
  <span className="flex flex-wrap gap-1">
    {RESOURCES.filter((k) => price[k] > 0).map((k) => (
      <span
        key={k}
        title={`${price[k]} ${k}`}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[13px]"
      >
        {price[k]} {RESOURCE_ICONS[k]}
      </span>
    ))}
  </span>
);

/** Info modal tabs, in display order. */
const TABS = [
  { key: 'recipes', label: '🧾 Recipes' },
  { key: 'achievements', label: '🏅 Achievements' },
] as const;

/**
 * ⓘ button on the map (under the 🔄 trade button). Opens a tabbed info modal:
 * every build recipe and its cost, and every way to earn victory points.
 */
const RecipesButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('recipes');

  // Escape closes the window (stopPropagation keeps the board's Escape
  // handler from also clearing the map selection).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseDown={(e) => e.stopPropagation()}
        title="Info"
        aria-label="Show recipes and achievements"
        className="absolute top-16 left-2 z-20 flex items-center justify-center w-12 h-12 rounded-full bg-white border-2 border-gray-300 shadow-lg text-2xl leading-none cursor-pointer hover:scale-110 hover:border-blue-500 transition-transform"
      >
        <span aria-hidden="true">ℹ️</span>
      </button>

      {open && (
        <div
          className={backdropClass}
          onMouseDown={(e) => {
            // Click outside the card closes it.
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Recipes and achievements"
            className={`${modalCardClass} max-w-[440px] max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="m-0 text-lg font-bold text-gray-800">ℹ️ Info</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close info"
                className="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div role="tablist" className="flex gap-1 mb-3 border-b border-gray-200">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 -mb-px text-[13px] font-semibold border-b-2 cursor-pointer ${
                    tab === t.key
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'recipes' ? (
              <ul role="tabpanel" className="m-0 p-0 list-none flex flex-col gap-2">
                {RECIPES.map((r) => (
                  <li key={r.name} className="border border-gray-200 rounded-md p-2 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-gray-800">
                        {r.icon} {r.name}
                      </span>
                      {r.price ? (
                        <CostChips price={r.price} />
                      ) : (
                        <span className="text-[13px]">{r.costText}</span>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-500 m-0 mt-1">{r.note}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div role="tabpanel">
                <p className="text-[12px] text-gray-500 m-0 mb-2">
                  First to {WIN_VP} VP wins. Bonuses go to one player; a tie keeps the current holder.
                </p>
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {ACHIEVEMENTS.map((a) => (
                    <li key={a.name} className="border border-gray-200 rounded-md p-2 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold text-gray-800">
                          {a.icon} {a.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-[12px] font-bold text-amber-800">
                          +{a.vp} VP
                        </span>
                      </div>
                      <p className="text-[12px] text-gray-500 m-0 mt-1">{a.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RecipesButton;
