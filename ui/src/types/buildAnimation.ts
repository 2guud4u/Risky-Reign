export type BuildType = 'settlement' | 'city' | 'road' | 'soldier';

export interface BuildAnimationInfo {
  type: BuildType;
  locationId: string;
}
