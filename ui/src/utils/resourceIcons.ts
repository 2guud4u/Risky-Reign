import { DevelopmentCardType, ResourceKey } from 'common';
import { IconName } from '../components/ui/GameIcon';

/** GameIcon name for each resource type, used across the UI (trade offers, prices, hand). */
export const RESOURCE_ICONS: Record<ResourceKey, IconName> = {
  Wood: 'wood',
  Brick: 'brick',
  Sheep: 'sheep',
  Wheat: 'wheat',
  Ore: 'ore',
};

/** GameIcon name for each development card type (hand, prompts, recipes). */
export const DEV_CARD_ICONS: Record<DevelopmentCardType, IconName> = {
  knight: 'knight',
  road_building: 'road',
  year_of_plenty: 'gift',
  monopoly: 'coins',
  victory_point: 'star',
};
