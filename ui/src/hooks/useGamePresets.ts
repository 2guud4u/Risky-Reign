import { useCallback, useState } from 'react';
import { Board, DockSpec, extractDocks, HexLayout, PublicGameRoom, TurnMode } from 'common';

/** A saved game preset: bundled rules + board layout (browser-local). */
export interface GamePreset {
  name: string;
  savedAt: number;
  rules: {
    pointsToWin: number;
    turnMode: TurnMode;
    setupCities: number;
    turnTimerMs: number;
  };
  map: HexLayout[];
  /** Dock placements (coast indices); absent on older presets = reroll. */
  docks?: DockSpec[];
}

const STORAGE_KEY = 'rr.gamePresets.v1';

/** Serialize the live board back to the HexLayout shape the server accepts. */
export function boardToLayouts(board: Board): HexLayout[] {
  return Object.values(board.hexes).map((h) => ({
    coord: h.coord,
    terrain: h.terrain,
    rollNumber: h.rollNumber,
  }));
}

/** Snapshot a room's current rules + board into a preset. */
export function presetFromRoom(room: PublicGameRoom, name: string): GamePreset | null {
  if (!room.board) return null;
  return {
    name,
    savedAt: Date.now(),
    rules: {
      pointsToWin: room.pointsToWin,
      turnMode: room.turnMode,
      setupCities: room.setupCities,
      turnTimerMs: room.turnTimerMs,
    },
    map: boardToLayouts(room.board),
    docks: extractDocks(room.board),
  };
}

function readPresets(): GamePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as GamePreset[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Named game presets kept in localStorage (per browser — there are no player
 * accounts to key server storage on). Presets are browser-local saves, so
 * they're never gated by the room's customization lock: anyone may save one;
 * only someone who may edit may *load* one (loading emits room changes).
 */
export function useGamePresets() {
  const [presets, setPresets] = useState<GamePreset[]>(readPresets);

  const persist = useCallback((next: GamePreset[]) => {
    setPresets(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota errors are non-fatal: the in-memory list stays until reload.
    }
  }, []);

  /** Save under `name`; an existing preset with the same name is overwritten. */
  const save = useCallback(
    (preset: GamePreset) => {
      persist([...presets.filter((p) => p.name !== preset.name), preset]);
    },
    [presets, persist],
  );

  const remove = useCallback(
    (name: string) => {
      persist(presets.filter((p) => p.name !== name));
    },
    [presets, persist],
  );

  return { presets, save, remove };
}
