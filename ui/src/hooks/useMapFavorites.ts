import { useCallback, useState } from 'react';
import { MAP_CATALOG } from 'common';

const STORAGE_KEY = 'rr.mapFavorites.v1';

/**
 * Marketplace map favorites (see glossary "Map favorite"): a browser-local
 * list of catalog ids starred in the Maps tab, stored like game presets.
 * On first load the list is seeded from each entry's `favoriteDefault`
 * (Westeros ships pre-favorited for everyone).
 */
export function useMapFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string');
      }
    } catch {
      // fall through to seed
    }
    return MAP_CATALOG.filter((m) => m.favoriteDefault).map((m) => m.id);
  });

  const toggle = useCallback(
    (id: string) => {
      const next = favorites.includes(id)
        ? favorites.filter((f) => f !== id)
        : [...favorites, id];
      setFavorites(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Quota errors are non-fatal: the in-memory list stays until reload.
      }
    },
    [favorites]
  );

  return { favorites, toggle };
}
