import { useCallback, useMemo, useRef, useState } from 'react';
import { CubeCoord, Terrain, Board, DockSpec, HexLayout, extractDocks, randomDocks } from 'common';
import { EditorMap, Tactic, Target, TerrainTarget } from './types';
import {
  applyTerrain,
  assignNumbers,
  assignTerrain,
  boardToMap,
  canCarryNumber,
  computeCoastRing,
  coordKey,
  dockSpanTo,
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
  // Dock draft: indices into `coast`. Seeded from the room board so the
  // editor shows the live harbors; absent board => fresh random layout.
  const [docks, setDocks] = useState<DockSpec[]>(() => {
    if (initialBoard) return extractDocks(initialBoard);
    return randomDocks(computeCoastRing(standardBoardMap()).length);
  });
  // Signature of the draft as last seeded/loaded — the "hand-edited" check the
  // marketplace uses before replacing the canvas. Any map/dock mutation that
  // diverges from this baseline makes the draft dirty again.
  const baselineRef = useRef<string | null>(null);
  const signature = (m: EditorMap, d: DockSpec[]) =>
    JSON.stringify(
      Object.values(m)
        .map((h) => [h.coord.q, h.coord.r, h.terrain, h.rollNumber])
        .sort()
    ) + JSON.stringify(d.map((x) => [x.port, x.coast]));
  const draftDirty = signature(map, docks) !== baselineRef.current;
  if (baselineRef.current === null) baselineRef.current = signature(map, docks);

  // The coast ring follows the map; dock indices are positions along it.
  const coast = useMemo(() => computeCoastRing(map), [map]);
  const coastLen = coast.length;

  /** Move dock `i` so its span starts at coast index `to` (width kept). */
  const moveDock = useCallback(
    (i: number, to: number) => {
      if (coastLen === 0) return;
      setDocks((ds) =>
        ds.map((d, idx) =>
          idx !== i
            ? d
            : { ...d, coast: d.coast.slice(0, 2).map((_, j) => (to + j) % coastLen) }
        )
      );
    },
    [coastLen]
  );

  /** Drag dock `i`'s span end (0|1) to coast index `to` — stretch, shrink,
      or (on a distant drop) re-anchor the span there. */
  const stretchDock = useCallback(
    (i: number, end: 0 | 1, to: number) => {
      if (coastLen === 0) return;
      setDocks((ds) =>
        ds.map((d, idx) => {
          if (idx !== i) return d;
          const s = d.coast[end === 0 ? 1 : 0] ?? d.coast[0]; // the fixed end
          return { ...d, coast: dockSpanTo(s, to, coastLen, d) };
        })
      );
    },
    [coastLen]
  );

  /** Re-roll the dock layout over the current coast (same 9-dock mix the
      server uses for fresh maps). */
  const randomizeDocks = useCallback(() => {
    setDocks(randomDocks(coastLen));
  }, [coastLen]);

  /** Place a new dock at coast index `to` (len-1 span; occupied/invalid no-op). */
  const addDock = useCallback(
    (to: number, port: DockSpec['port']) => {
      if (coastLen === 0) return;
      const t = ((to % coastLen) + coastLen) % coastLen;
      setDocks((ds) =>
        ds.some((d) => d.coast.includes(t)) ? ds : [...ds, { port, coast: [t] }]
      );
    },
    [coastLen]
  );

  /** Remove dock `i` (trash drop / Delete button). */
  const removeDock = useCallback((i: number) => {
    setDocks((ds) => ds.filter((_, idx) => idx !== i));
  }, []);

  /** Set dock `i`'s port type (palette click while selected). */
  const setDockPort = useCallback((i: number, port: DockSpec['port']) => {
    setDocks((ds) => ds.map((d, idx) => (idx === i ? { ...d, port } : d)));
  }, []);

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

  /** Assign terrain across the map per the chosen tactic/target/water rule. */
  const assignTerrainDraft = (tactic: Tactic, target: TerrainTarget, excludeWater: boolean) => {
    setMap((m) => assignTerrain(m, tactic, target, excludeWater));
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
    const m = standardBoardMap();
    setMap(m);
    // Map resets re-roll the docks over the new coast (the map's own reset,
    // so the draft doesn't keep stale indices against a different ring).
    const d = randomDocks(computeCoastRing(m).length);
    setDocks(d);
    setSelectedCoord(null);
    baselineRef.current = signature(m, d);
  };

  const resetToExpansion = () => {
    const m = expansionBoardMap();
    setMap(m);
    const d = randomDocks(computeCoastRing(m).length);
    setDocks(d);
    setSelectedCoord(null);
    baselineRef.current = signature(m, d);
  };

  /**
   * Load a marketplace/preset layout into the draft: exact hexes + authored
   * docks replace the current map, selections clear, and the dirty baseline
   * re-seeds so the fresh load itself doesn't count as hand-edited.
   */
  const loadDraft = (layouts: HexLayout[], draftDocks: DockSpec[]) => {
    const m: EditorMap = {};
    for (const l of layouts) {
      m[coordKey(l.coord)] = {
        coord: l.coord,
        terrain: l.terrain as Terrain,
        rollNumber: l.rollNumber,
      };
    }
    setMap(m);
    setDocks(draftDocks);
    setSelectedCoord(null);
    baselineRef.current = signature(m, draftDocks);
  };

  return {
    map,
    docks,
    coast,
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
    moveDock,
    stretchDock,
    randomizeDocks,
    addDock,
    removeDock,
    setDockPort,
    placeNumber,
    paintHex,
    resetToStandard,
    resetToExpansion,
    loadDraft,
    assignTerrainDraft,
    draftDirty,
  };
}
