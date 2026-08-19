import { CubeCoord } from './Coordinates';

/**
 * Input shape for board generation. Types only — the generators live in
 * `utils/boardGenerator.ts`.
 */

export interface HexLayout {
  coord: CubeCoord;
  terrain: string;
  rollNumber: number | null;
}
