// import { Resource } from './Board';
import { DevCard } from './Pieces';
// export default interface Player {
//     name: string;
//     color: string;
//     resources: Map<Resource, number>;
//     devCards: DevCard[];
// }
export interface Player {
  id: string;
  name: string;
  symbol: 'X' | 'O';
}

