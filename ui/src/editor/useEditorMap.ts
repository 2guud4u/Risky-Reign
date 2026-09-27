import { useCallback, useState } from 'react';
import { CubeCoord, Terrain, Board } from 'common';
import { EditorMap, Tactic, Target } from './types';
import {
  applyTerrain,
  assignNumbers,
  boardToMap,
  canCarryNumber,
  cloneMap,
  coordKey,
  expansionBoardMap,
  standardBoardMap,
} from './utils';

/**
 * The editor's working state: the sparse `EditorMap`, the currently selected
 * hex, and every mutation the canvas / toolbar can perform. All mutators are
 * pure `EditorMap → EditorMap` transforms applied through `setMap`, so they
 * stay safe under React's double-invocation of updaters.
 */
export function useEditorMap(initialBoard?: Board) {
  const [map, setMap] = useState<EditorMap>(() => (initialBoard ? boardToMap(initialBoard) : standardBoardMap()));
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null);

  const selectedHex = selectedCoord ? map[selectedCoord] : null;

  const addHex = useCallback((coord: CubeCoord, terrain: Terrain) => {
    setMap((m) => {
      const key = coordKey(coord);
      if (m[key]) return m; // already placed
      return { ...m, [key]: { coord, terrain, rollNumber: null } };
    });
  }, []);

  const removeHex = useCallback((key: string) => {
    setMap((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });
    setSelectedCoord((c) => (c === key ? null : c));
  }, []);

  const clearNumber = useCallback((key: string) => {
    setMap((m) => {
      const hex = m[key];
      if (!hex) return m;
      return { ...m, [key]: { ...hex, rollNumber: null } };
    });
  }, []);

  /** Apply a terrain to the currently selected hex (palette click). */
  const setTerrain = (terrain: Terrain) => {
    if (!selectedCoord) return;
    setMap((m) => {
      const hex = m[selectedCoord];
      if (!hex) return m;
      return { ...m, [selectedCoord]: applyTerrain(hex, terrain) };
    });
  };

  /** Set (or clear) the roll number on the currently selected hex. */
  const setNumber = (n: number | null) => {
    if (!selectedCoord) return;
    setMap((m) => {
      const hex = m[selectedCoord];
      if (!hex) return m;
      if (!canCarryNumber(hex.terrain)) return m; // no numbers on Desert/Water
      return { ...m, [selectedCoord]: { ...hex, rollNumber: n } };
    });
  };

  /** Assign roll numbers across the map per the chosen tactic/target. */
  const assign = (tactic: Tactic, target: Target) => {
    setMap((m) => assignNumbers(m, tactic, target));
  };

  const moveHex = useCallback((from: CubeCoord, to: CubeCoord) => {
    setMap((m) => {
      const fromKey = coordKey(from);
      const toKey = coordKey(to);
      const hex = m[fromKey];
      if (!hex || m[toKey]) return m;
      const next = { ...m };
      delete next[fromKey];
      next[toKey] = { ...hex, coord: to };
      return next;
    });
  }, []);

  const moveNumber = useCallback((from: CubeCoord, to: CubeCoord) => {
    setMap((m) => {
      const fromKey = coordKey(from);
      const toKey = coordKey(to);
      const src = m[fromKey];
      const dst = m[toKey];
      if (!src || src.rollNumber === null || !dst) return m;
      if (!canCarryNumber(dst.terrain)) return m;
      const next = { ...m };
      // Swap the numbers: the source takes the target's number (null if the
      // target has none, i.e. a plain move), the target takes the source's.
      next[fromKey] = { ...src, rollNumber: dst.rollNumber };
      next[toKey] = { ...dst, rollNumber: src.rollNumber };
      return next;
    });
  }, []);

  const placeNumber = useCallback((coord: CubeCoord, number: number) => {
    setMap((m) => {
      const key = coordKey(coord);
      const hex = m[key];
      if (!hex) return m;
      if (!canCarryNumber(hex.terrain)) return m;
      return { ...m, [key]: { ...hex, rollNumber: number } };
    });
  }, []);

  /** Paint mode: apply the given terrain to the hex at `coord`. */
  const paintHex = useCallback((coord: CubeCoord, terrain: Terrain) => {
    setMap((m) => {
      const key = coordKey(coord);
      const hex = m[key];
      if (!hex) return m;
      return { ...m, [key]: applyTerrain(hex, terrain) };
    });
  }, []);

  const resetToStandard = () => {
    setMap(standardBoardMap());
    setSelectedCoord(null);
  };

  const resetToExpansion = () => {
    setMap(expansionBoardMap());
    setSelectedCoord(null);
  };

  /** Restore a saved snapshot (go back to it). */
  const restore = (snapshotMap: EditorMap) => {
    setMap(cloneMap(snapshotMap));
    setSelectedCoord(null);
  };

  return {
    map,
    selectedCoord,
    setSelectedCoord,
    selectedHex,
    addHex,
    removeHex,
    clearNumber,
    setTerrain,
    setNumber,
    assign,
    moveHex,
    moveNumber,
    placeNumber,
    paintHex,
    resetToStandard,
    resetToExpansion,
    restore,
  };
}
