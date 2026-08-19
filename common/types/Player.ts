import { ResourceCount } from './Logic';

export interface Player {
  id: string;
  name: string;
  color: string;
  resources: ResourceCount;
}
