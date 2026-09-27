import { Terrain, VALID_ROLL_NUMBERS, LOBBY_HEX_SIZE } from 'common';

/** Terrain palette order for the editor toolbar. */
export const TERRAIN_OPTIONS: Terrain[] = ['Wood', 'Sheep', 'Wheat', 'Brick', 'Ore', 'Desert', 'Water'];

/** Standard dice tokens a hex may carry (sourced from common). */
export const NUMBER_OPTIONS = [...VALID_ROLL_NUMBERS];

/** 5-6 player expansion terrain breakdown (30 tiles, no Water). */
export const EXPANSION_TERRAIN_COUNTS: Record<Terrain, number> = {
  Wood: 6,
  Sheep: 6,
  Wheat: 6,
  Brick: 5,
  Ore: 5,
  Desert: 2,
  Water: 0,
  Nothing: 0,
};

/** 5-6 player expansion token distribution (28 tokens for the 28 resource hexes). */
export const EXPANSION_TOKENS: Record<number, number> = {
  2: 2,
  3: 3,
  4: 3,
  5: 3,
  6: 3,
  8: 3,
  9: 3,
  10: 3,
  11: 3,
  12: 2,
};

/** Shared input styling for the editor's form fields. */
export const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm';

/** Board units per hex in the editor canvas (matches the lobby board size). */
export const HEX_SIZE = LOBBY_HEX_SIZE;
/** Window radius around the view center (infinite grid). */
export const GRID_RADIUS = 8;
/** Screen px before a drag becomes a pan. */
export const PAN_THRESHOLD = 5;
/** Board units; click within this of a hex center grabs its number. */
export const TOKEN_RADIUS = 16;

/** Base viewBox width of the editor canvas (board units at scale 1). */
export const CANVAS_BASE_WIDTH = 900;
/** Base viewBox height of the editor canvas (board units at scale 1). */
export const CANVAS_BASE_HEIGHT = 650;
/** Zoom multiplier per wheel step (scroll up zooms in). */
export const ZOOM_FACTOR = 1.1;
/** Zoom bounds for the wheel handler. */
export const MIN_EDITOR_ZOOM = 0.4;
export const MAX_EDITOR_ZOOM = 3;

/** Fraction of HEX_SIZE used for the drawn polygon (small gutter between hexes). */
export const HEX_SCALE = 0.96;
/** Radius (board units) of the white number token circle. */
export const TOKEN_CIRCLE_RADIUS = 16;
/** Font size (board units) of the roll number on a token. */
export const TOKEN_FONT_SIZE = 16;
/** Stroke width of the number token circle. */
export const TOKEN_STROKE_WIDTH = 1.5;
/** Font size (board units) of the "Desert" label inside a desert hex. */
export const DESERT_LABEL_FONT_SIZE = 12;

/** Stroke widths (board units) for hex cells. */
export const CELL_STROKE = {
  empty: 1,
  placed: 2,
  active: 4,
} as const;
/** Stroke width of the drop-target preview outline. */
export const PREVIEW_STROKE_WIDTH = 3;
/** Stroke width of the preview number token. */
export const PREVIEW_TOKEN_STROKE_WIDTH = 2.5;
/** Opacity of a hex/token while it is the source of an in-canvas drag. */
export const DRAG_SOURCE_OPACITY = 0.4;
/** Opacity of the drag ghost preview. */
export const PREVIEW_OPACITY = 0.85;
/** Fill opacity of a terrain ghost preview. */
export const PREVIEW_FILL_OPACITY = 0.5;
/** Dash pattern for unplaced grid cells. */
export const EMPTY_CELL_DASH = '6 4';
/** Dash pattern for the drop-target preview outline. */
export const PREVIEW_DASH = '8 4';

/** SVG colors used by the editor canvas (not themed via CSS). */
export const EDITOR_COLORS = {
  emptyCellStroke: '#d1d5db',
  placedStroke: '#374151',
  hoverStroke: '#16a34a',
  selectedStroke: '#f59e0b',
  invalidStroke: '#dc2626',
  hexFallbackFill: '#eee',
  tokenFill: '#fff',
  tokenStroke: '#111',
  desertLabel: '#92400e',
} as const;

