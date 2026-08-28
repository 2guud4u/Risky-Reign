import { Price, ResourceCount } from '../types/Logic';

/**
 * Building cost constants and the affordability check (pure code). The
 * `ResourceCount` / `Price` types live in `types/Logic.ts`.
 */

export const SettlementPrice: Price = { Wood: 1, Brick: 1, Sheep: 1, Wheat: 1, Ore: 0 };
export const RoadPrice: Price = { Wood: 1, Brick: 1, Sheep: 0, Wheat: 0, Ore: 0 };
export const SoldierPrice: Price = { Wood: 0, Brick: 0, Sheep: 1, Wheat: 1, Ore: 0 };
export const CityPrice: Price = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 2, Ore: 3 };

/** Cost to buy a development card (standard Catan price). */
export const DevelopmentCardPrice: Price = { Wood: 0, Brick: 1, Sheep: 0, Wheat: 1, Ore: 1 };

/** Default player color palette, cycled by join order when a player picks none. */
export const PLAYER_COLORS: string[] = [
  '#e6194B',
  '#3cb44b',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#42d4f4',
  '#f032e6',
  '#bfef45',
  '#469990',
  '#ee8434',
];

/** Whether a player's resources can cover the (positive) price. */
export function canAfford(resources: ResourceCount, price: Price): boolean {
  return (Object.keys(price) as (keyof Price)[]).every((k) => resources[k] >= price[k]);
}
