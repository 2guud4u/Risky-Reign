export type BuildType = 'settlement' | 'city' | 'road' | 'soldier' | 'ship' | 'wall';

export interface BuildAnimationInfo {
  type: BuildType;
  locationId: string;
}
