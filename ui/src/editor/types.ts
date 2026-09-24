import { CubeCoord, Terrain, Board } from 'common';

/**
 * A single placed hex in the board editor draft.
 */
export interface EditorHex {
  coord: CubeCoord;
  terrain: Terrain;
  rollNumber: number | null;
}

/**
 * The editor's working state: a sparse map of placed hexes, keyed by the
 * canonical cube-coord string (e.g. "0,0,0").
 */
export type EditorMap = Record<string, EditorHex>;

/** Number-assignment strategy for the "Assign numbers" action. */
export type Tactic = 'equal' | 'random' | 'current';

/** Which hexes the number-assignment targets. */
export type Target = 'only empty' | 'only filled' | 'all';

/** Props for the board editor page. */
export interface BoardEditorProps {
  /** When set, the editor edits this existing room's board (Save → editBoard). */
  roomId?: string;
  /** The board to seed the draft from (defaults to a standard board). */
  initialBoard?: Board;
  onBack: () => void;
}

/** Props for the board editor canvas. */
export interface BoardEditorCanvasProps {
  map: EditorMap;
  selectedTerrain: Terrain;
  selectedCoord: string | null;
  onSelect: (coordKey: string | null) => void;
  onAdd: (coord: CubeCoord, terrain: Terrain) => void;
  onRemove: (coordKey: string) => void;
  onClearNumber: (coordKey: string) => void;
  onMoveHex: (from: CubeCoord, to: CubeCoord) => void;
  onMoveNumber: (from: CubeCoord, to: CubeCoord) => void;
  onPlaceNumber: (coord: CubeCoord, number: number) => void;
  onPaint: (coord: CubeCoord) => void;
  paintMode: boolean;
  toolbarDrag: { kind: 'terrain' | 'number'; value: Terrain | number } | null;
}
