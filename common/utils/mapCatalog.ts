import { MapCatalogEntry } from '../types/MapCatalog';
import { WESTEROS_DOCKS, WESTEROS_LAYOUTS, WESTEROS_REGIONS } from '../maps/westeros';

/**
 * The marketplace map catalog (ADR 0002): official prebuilt boards shipped in
 * the bundle, browsable from the editor's Maps tab. The record shape —
 * id/name/author/tags/layouts/docks — is the contract future community-made
 * maps will fill in.
 */
export const MAP_CATALOG: MapCatalogEntry[] = [
  {
    id: 'westeros',
    name: 'Westeros',
    author: 'Official',
    tags: ['Game of Thrones', '7 kingdoms'],
    layouts: WESTEROS_LAYOUTS,
    docks: WESTEROS_DOCKS,
    favoriteDefault: true,
    regions: WESTEROS_REGIONS,
  },
];

/** Look up a marketplace map by id; null when unknown. */
export function mapById(id: string): MapCatalogEntry | null {
  return MAP_CATALOG.find((m) => m.id === id) ?? null;
}
