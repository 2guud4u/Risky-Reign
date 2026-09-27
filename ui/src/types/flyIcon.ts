import { ResourceKey } from 'common';

/** A single resource icon flying from a source point to a target point. */
export interface FlyIcon {
  id: number;
  resource: ResourceKey;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  delay: number;
}
