import { HexLayout } from './BoardGenerator';
import { DockSpec } from './BoardGenerator';

/**
 * One marketplace map (see ADR 0002): a self-contained board record shipped
 * in the bundle. `author`/`tags`/`favoriteDefault` exist from day one so the
 * shape is the contract community-made maps will fill in later — today every
 * entry is Official.
 */
export interface MapCatalogEntry {
  /** Stable id, e.g. 'westeros' — favorites are keyed on this. */
  id: string;
  name: string;
  author: string;
  tags: string[];
  /** Full authored layout: land hexes, authored water, fixed roll numbers. */
  layouts: HexLayout[];
  /** Authored harbor placements as coast-ring indices. */
  docks: DockSpec[];
  /** Seed into every browser's favorites on first load. */
  favoriteDefault?: boolean;
  /** Region label per land hex ('q,r,s' key → region) for tooltips. */
  regions?: Record<string, string>;
}
