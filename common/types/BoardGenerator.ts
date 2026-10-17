import { CubeCoord } from './Coordinates';
import { PortType } from './Board';

/**
 * Input shape for board generation. Types only — the generators live in
 * `utils/boardGenerator.ts`.
 */

export interface HexLayout {
  coord: CubeCoord;
  terrain: string;
  rollNumber: number | null;
}

/**
 * A persistent dock spec: the port type and the coast-vertex indices it
 * spans. Indices address the angle-sorted coast ring (vertices touching
 * exactly one land hex, neighbors water-or-empty); out-of-range indices drop
 * that dock. Saved with the board so a hand-placed coast survives reloads.
 */
export interface DockSpec {
  port: PortType;
  /** 1-2 consecutive indices into the coast ring. */
  coast: number[];
}
