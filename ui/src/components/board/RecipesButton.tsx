import React, { useEffect, useState } from 'react';
import {
  CityPrice,
  DevelopmentCardPrice,
  HealSoldierAmount,
  HealSoldierResources,
  Price,
  RESOURCES,
  RoadPrice,
  SettlementPrice,
  SoldierPrice,
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

/** The cost as one icon chip per card (e.g. 🌾 🌾 ⛏️ ⛏️ ⛏️). */
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

/**
 * ⓘ button on the map (under the 🤝 trade button). Opens a modal listing every
 * build recipe and its cost.
 */
const RecipesButton: React.FC = () => {
  const [open, setOpen] = useState(false);

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
        title="Recipes"
        aria-label="Show build recipes"
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
            aria-label="Recipes"
            className={`${modalCardClass} max-w-[440px] max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="m-0 text-lg font-bold text-gray-800">ℹ️ Recipes</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close recipes"
                className="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
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
          </div>
        </div>
      )}
    </>
  );
};

export default RecipesButton;
