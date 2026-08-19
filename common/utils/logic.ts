import { Price, ResourceCount } from '../types/Logic';

/**
 * Building cost constants and the affordability check (pure code). The
 * `ResourceCount` / `Price` types live in `types/Logic.ts`.
 */

export const SettlementPrice: Price = { Wood: 1, Brick: 1, Sheep: 1, Wheat: 1, Ore: 0 };
export const RoadPrice: Price = { Wood: 1, Brick: 1, Sheep: 0, Wheat: 0, Ore: 0 };
export const SoldierPrice: Price = { Wood: 0, Brick: 1, Sheep: 1, Wheat: 1, Ore: 0 };

/** Whether a player's resources can cover the (positive) price. */
export function canAfford(resources: ResourceCount, price: Price): boolean {
  return (Object.keys(price) as (keyof Price)[]).every((k) => resources[k] >= price[k]);
}
