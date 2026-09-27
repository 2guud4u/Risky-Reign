import type { DragEvent, Ref } from 'react';
import { CubeCoord, Terrain, Board, ValidationResult } from 'common';

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

/** A drag payload started from the editor toolbar (a terrain or a number). */
export interface ToolbarDrag {
  kind: 'terrain' | 'number';
  value: Terrain | number;
}

/** Which kind of in-canvas drag is in progress (drives dimming + preview). */
export type CanvasDragKind = 'hex' | 'number';

/**
 * In-progress pointer drag inside the editor canvas. A press on empty space
 * pans; a press on a hex drags the hex; a press on its token drags the number.
 * `moved` flips true once the pointer travels past `PAN_THRESHOLD`.
 */
export type CanvasDragState =
  | { kind: 'pan'; startX: number; startY: number; originX: number; originY: number; moved: boolean }
  | { kind: 'hex'; from: CubeCoord; startX: number; startY: number; moved: boolean }
  | { kind: 'number'; from: CubeCoord; value: number; startX: number; startY: number; moved: boolean };

/** A saved board snapshot in the editor's undo-history list. */
export interface EditorHistorySnapshot {
  id: number;
  label: string;
  time: string;
  map: EditorMap;
}

/** Props for the top bar (back/reset buttons + validity summary). */
export interface EditorTopBarProps {
  onBack: () => void;
  onResetStandard: () => void;
  onResetExpansion: () => void;
  hexCount: number;
  validation: ValidationResult;
  missingNumbers: number;
}

/** Props for the terrain palette panel. */
export interface TerrainPaletteProps {
  paintMode: boolean;
  onTogglePaintMode: () => void;
  terrainCounts: Record<Terrain, number>;
  /** The terrain a click applies (the selected hex's terrain, else the toolbar selection). */
  activeTerrain: Terrain | null;
  onTerrainClick: (terrain: Terrain) => void;
  onTerrainDragStart: (e: DragEvent, terrain: Terrain) => void;
  onDragEnd: () => void;
}

/** Props for the number palette + assign-numbers panel. */
export interface NumberPaletteProps {
  selectedNumber: number | null;
  numberCounts: Record<number, number>;
  tactic: Tactic;
  target: Target;
  onTacticChange: (tactic: Tactic) => void;
  onTargetChange: (target: Target) => void;
  onNumberClick: (n: number) => void;
  onNumberDragStart: (e: DragEvent, n: number) => void;
  onDragEnd: () => void;
  onAssign: () => void;
}

/** Props for the save/start panel (name + room inputs, history list). */
export interface SavePanelProps {
  roomId?: string;
  map: EditorMap;
  validation: ValidationResult;
  missingNumbers: number;
  onRestore: (map: EditorMap) => void;
}

/** Props for a single hex cell rendered inside the editor canvas. */
export interface EditorHexCellProps {
  cellKey: string;
  coord: CubeCoord;
  placed?: EditorHex;
  isSelected: boolean;
  isHover: boolean;
  isDragSource: boolean;
  dragKind: CanvasDragKind | null;
  onRemove: (coordKey: string) => void;
}

/** Props for the drag ghost preview drawn over the hovered cell. */
export interface DragPreviewProps {
  hoverKey: string;
  /** 'terrain' for toolbar terrain drags; 'hex'/'number' for in-canvas drags. */
  activeDragKind: 'terrain' | CanvasDragKind;
  previewNumber: number | null;
  isToolbarTerrain: boolean;
  toolbarTerrain: Terrain | null;
  map: EditorMap;
}

/** Props for the trash-can overlay (drop target for deleting hexes/numbers). */
export interface TrashCanProps {
  ref: Ref<HTMLDivElement>;
  draggingDeletable: boolean;
  overTrash: boolean;
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
  toolbarDrag: ToolbarDrag | null;
}
