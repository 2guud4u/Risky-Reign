/**
 * UI-only presentation constants (SVG layout sizes, spacings, thresholds).
 *
 * Domain values that must stay in sync with the backend (hex sizes, prices,
 * limits) live in `common/Constant.ts` instead — only pure rendering knobs
 * belong here.
 */

import { GAME_HEX_SIZE, Price } from 'common';

// ── BoardView ────────────────────────────────────────────────────────────────

/** Internal projection size — must match the backend's board projection. */
export const PROJ_SIZE = GAME_HEX_SIZE;

/** Distance from a vertex center to its soldier badges, as a fraction of the hex size. */
export const SOLDIER_BADGE_RADIUS_FRACTION = 0.2;

/** Radius of a soldier badge circle (SVG units). */
export const SOLDIER_BADGE_R = 10;

/** Vertical offset below a vertex center to the soldier badge row, as a fraction of the hex size. */
export const SOLDIER_BADGE_ROW_OFFSET_FRACTION = 0.2;

/** Horizontal gap between adjacent soldier badges in a row. */
export const SOLDIER_BADGE_GAP = 4;

/** Max distance from a target vertex to accept a dropped soldier, as a fraction of the hex size. */
export const DROP_THRESHOLD_FRACTION = 0.45;

/** Radius of the valid drop-target highlight ring (SVG units). */
export const DROP_TARGET_RING_R = 16;

/** Robber image width, as a fraction of the hex size. */
export const ROBBER_W_FRACTION = 1.4;
/** Robber image height, as a fraction of the hex size. */
export const ROBBER_H_FRACTION = 1.05;
/** Robber image top offset above the hex center, as a fraction of the hex size. */
export const ROBBER_Y_OFFSET_FRACTION = 1.05;
/** Battle HUD: robber image width, as a multiple of TROOP_R. */
export const ROBBER_BATTLE_W = 2.8;
/** Battle HUD: robber image height, as a multiple of TROOP_R. */
export const ROBBER_BATTLE_H = 2.8;

/** Fraction of the natural board size added to the viewBox so coast trade ports aren't clipped. */
export const BOARD_VIEWBOX_MARGIN = 1.2;
/** Fraction of the natural board size added on-screen so the hex ring isn't clipped. */
export const BOARD_RENDER_MARGIN = 1.1;
/** Radius of vertex markers on the main board (SVG units). */
export const BOARD_VERTEX_SIZE = 8;
/** Render size of a port-dock icon (SVG units). */
export const PORT_DOCK_SIZE = 8;
/** Max coastal vertices served by one port dock. */
export const PORT_DOCK_MAX_VERTICES = 2;
/** Robber's-bag popup: horizontal offset right of the hex center (SVG units). */
export const ROBBER_BAG_X_OFFSET = 60;
/** Robber's-bag popup: extra upward offset past the robber art (SVG units). */
export const ROBBER_BAG_Y_OFFSET = 47;
/** Robber's-bag popup size (SVG units). */
export const ROBBER_BAG_WIDTH = 150;
export const ROBBER_BAG_HEIGHT = 95;
/** Stroke width of the valid drop-target highlight ring. */
export const DROP_TARGET_STROKE_W = 3;
/** Opacity of the soldier drag ghost. */
export const DRAG_GHOST_OPACITY = 0.6;
/** Opacity of the robber drag ghost. */
export const ROBBER_GHOST_OPACITY = 0.85;
// ── MiniView ─────────────────────────────────────────────────────────────────

/** Actual soldier-art width: the symbol viewBox (308.96 x 696.64) is letterboxed
 * into the 66-tall <use>, so the art is 66 * 308.96/696.64 wide. The
 * selection box must use this, not the 57-wide <use> viewport. */
export const SOLDIER_ART_WIDTH = 29.27;
/** Actual soldier-art height (the <use> viewport height). */
export const SOLDIER_ART_HEIGHT = 66;
/** Injured soldiers are drawn at this fraction of full size. */
export const INJURED_SOLDIER_SCALE = 1;

// Garrison formation: each owner's soldiers stand in tidy ranks — healthy in
// front, injured behind — with a count pill once the army is too big to draw.
// Sized so two armies side by side stay inside one vertex spacing on the board.
/** Soldiers per rank (row) in a formation. */
export const FORMATION_COLS = 5;
/** Most soldiers drawn per army; bigger armies show their total in a count pill. */
export const FORMATION_MAX_VISIBLE = 20;
/** Horizontal distance between soldiers in a rank (about one art width). */
export const FORMATION_COL_SPACING = 30;
/** How far each rank further back sits above the one in front of it. */
export const FORMATION_ROW_SPACING = 24;
/** Gap between neighboring armies on the same vertex. */
export const FORMATION_ARMY_GAP = 28;
/** Widest a line of armies may get before the next army wraps to a new line below. */
export const FORMATION_LINE_MAX_WIDTH = 220;
/** Count pill ("×12") height, font size and gap below an army's front rank. */
export const FORMATION_PILL_H = 22;
export const FORMATION_PILL_FONT = 15;
export const FORMATION_PILL_GAP = 4;
/** Count pill width per character of its label, plus side padding. */
export const FORMATION_PILL_CHAR_W = 9;
export const FORMATION_PILL_PAD = 8;
/** Space between wrapped lines of armies. */
export const FORMATION_LINE_GAP = 12;
/** Selected-soldier check badge: radius as a fraction of the art width. */
export const CHECK_BADGE_R_FRAC = 0.16;
/** Selected-soldier check badge: center height above the sprite center (as a fraction of art height). */
export const CHECK_BADGE_Y_OFF = 0.05;
/** Selected-soldier check badge: center height above the sprite center (as a fraction of full art height), injured soldiers (shorter sprite, sits higher). */
export const CHECK_BADGE_Y_OFF_INJURED = -.1;
export const CHECK_BADGE_COLOR = '#16a34a';
/** Energy bolt marking a soldier with an unspent action (mini-map). */
/** Bolt height as a fraction of the soldier art height. */
export const ACTION_BOLT_H_FRAC = 0.35;
/** Bolt width as a fraction of its own height. */
export const ACTION_BOLT_W_FRAC = 0.55;
/** Bolt center offset: 0 = centered on the soldier. */
export const ACTION_BOLT_X_OFF = 0;
/** Bolt center offset: 0 = centered on the soldier. */
export const ACTION_BOLT_Y_OFF = 0;
/** Bolt fill / outline colors. */
export const ACTION_BOLT_FILL = '#facc15';
export const ACTION_BOLT_STROKE = '#92680e';
/** Endpoint vertex circle radius when an edge is selected in the MiniView. */
export const MINI_ENDPOINT_R = 9;
/** Vertex marker radius a settlement/city glyph is sized from in the MiniView. */
export const MINI_SETTLEMENT_MARKER_R = 10;
/** Distance from a neighbor circle to its letter label in the MiniView. */
export const MINI_LABEL_DIST = 20;
/** Half-extent of a letter label glyph in the MiniView (for viewBox fitting). */
export const MINI_LABEL_HALF_W = 6;
export const MINI_LABEL_HALF_H = 9;
/** Letter label font size in the MiniView. */
export const MINI_LABEL_FONT = 15;

// ── BoardView (scale) ─────────────────────────────────────────────────────

/** Minimum scale for responsive board sizing within its panel. */
export const BOARD_MIN_SCALE = 0.5;
/** Maximum scale for responsive board sizing within its panel. */
export const BOARD_MAX_SCALE = 1.25;

// ── GameLogic ──────────────────────────────────────────────────────────────

/** How long (ms) a transient error toast stays visible before auto-dismissing. */
export const TOAST_DURATION_MS = 4000;

// ── BattleModal ────────────────────────────────────────────────────────────

/** Distance of each side's formation from the vertex center (world units). */
export const SIDE_OFFSET = 130;
/** Rolled troops stop this far inside the center clash line. */
export const CENTER_GAP = 15;
/** Vertical spacing between troops in a line. */
export const ROW_H = 34;
/** Troop circle radius. */
export const TROOP_R = 26;
/** Small soldier dot radius — matches how garrisoned soldiers are drawn in MiniView. */
export const SOLDIER_DOT_R = 6;
/** Horizontal spacing between columns of the waiting line. */
export const COL_W = 34;
/** Maximum troops in a single column of the waiting line. */
export const SIDE_COL_MAX = 6;
/** Horizontal spacing between troops in a repositioning row. */
export const REPOSITION_ROW_SPACING = 44;
/** Distance below the vertex center where the repositioning row sits. */
export const REPOSITION_ROW_OFFSET_Y = 60;
/** Rendered width of the injured-soldier icon in the repositioning view. */
export const REPOSITION_SOLDIER_W = 40;
/** Rendered height of the injured-soldier icon in the repositioning view. */
export const REPOSITION_SOLDIER_H = 46;
/** Neighbor vertex circle radius in the MiniView. */
export const MINI_NEIGHBOR_R = 8;
/** Selection ring radius in the MiniView. */
export const MINI_SELECT_RING_R = 15;
/** Selection circle radius in the MiniView. */
export const MINI_SELECT_CIRCLE_R = 11;
/** Highlight rectangle width in the MiniView. */
export const MINI_HIGHLIGHT_W = 30;
/** Highlight rectangle height in the MiniView. */
export const MINI_HIGHLIGHT_H = 70;

// ── ResourceGainLayer ──────────────────────────────────────────────────────

/** ms per card flight. */
export const GAIN_DURATION = 5000;
/** ms offset between successive cards. */
export const GAIN_STAGGER = 1100;
/** ms per card flight for the spend (build) animation. */
export const SPEND_DURATION = 5000;
/** ms offset between successive cards for the spend animation. */
export const SPEND_STAGGER = 1100;
/** Event that animates a build's spent resources flying to the location. */
export const BUILD_ANIMATION_EVENT = 'build:animation';

/** Board center (the desert hex). */
export const BOARD_CENTER = { q: 0, r: 0, s: 0 };

// ── BoardVertex (port) ─────────────────────────────────────────────────────

/** Port (harbor) presentation — all sized relative to the vertex `size`. */
/** How far past the vertex the badge sits (into the water). */
export const PORT_OFFSET = 5;
/** Badge radius. */
export const PORT_RADIUS = 2.4;
/** Ratio font size (the "2:1"/"3:1" under the glyph). */
export const PORT_RATIO_TEXT = 1.25;
/** Glyph font size. */
export const PORT_TEXT = 1.5;
/** Generic port ring (3:1) — warm amber. */
export const PORT_GENERIC_FILL = '#e0a32e';
/** Special port ring (2:1) — pleasant blue. */
export const PORT_SPECIAL_FILL = '#4a90d9';
/** Port ring + label stroke. */
export const PORT_STROKE = '#2a3a4a';
/** Badge face fill — white coin. */
export const PORT_FACE_FILL = '#ffffff';
/** Ratio label color. */
export const PORT_LABEL_FILL = '#33475b';
/** Pier (dock road) fill — wood. */
export const PORT_PIER = '#b08d57';
/** Pier edge — darker wood. */
export const PORT_PIER_EDGE = '#6e5230';
/** Plank spacing along a dock pier, as a fraction of the port size. */
export const PORT_PLANK_GAP = 0.9;
/** Plank slat stroke width, as a fraction of the port size. */
export const PORT_PLANK_W = 0.16;

// ── Game (layout) ──────────────────────────────────────────────────────────

/** Gap between the bottom control row / dice and the window edges. */
export const MAP_CORNER_INSET_PX = 12;

// ── useBoardViewport ───────────────────────────────────────────────────────

/** Zoom limits relative to the board's natural (zoom-1) size. */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 6;
/** Zoom step per wheel tick / button press. */
export const ZOOM_STEP = 1.15;
/** Minimum pointer movement (px) before a press counts as a pan. */
export const PAN_THRESHOLD = 4;
/** Smallest distance (px) between two touch points before a pinch zooms. */
export const PINCH_MIN_DIST = 12;
/** Transparent hit-line width (board units) for selecting/pressing a road; the visible road stays thin. */
export const ROAD_HIT_WIDTH = 22;
/** Zoom the board animates to when a vertex or edge is clicked (never zooms out). */
export const SELECT_FOCUS_ZOOM = 4;
/** Duration of the click-to-focus animation, in ms. */
export const FOCUS_DURATION_MS = 350;
/**
 * Minimum zoom for individual soldier SVGs instead of count badges.
 * Click-to-focus (SELECT_FOCUS_ZOOM) reaches this threshold.
 */
export const DETAIL_ZOOM_IN = 4;
/**
 * Size of detailed soldiers on the main board relative to the mini view. The
 * mini view lays a garrison out over ~2 vertex-spacings; the board's vertices
 * are 100 units apart, so clusters are scaled down to stay near their vertex.
 */
export const BOARD_SOLDIER_SCALE = 0.4;

// ── useBuildRules ──────────────────────────────────────────────────────────

/** "Afford any price" resource counts for free (Road Card) builds. */
export const UNLIMITED_RESOURCES: Price = { Wood: 99, Brick: 99, Sheep: 99, Wheat: 99, Ore: 99 };

// ── Trade / Dice ───────────────────────────────────────────────────────────

/** Zeroed price, used as a starting accumulator for resource gains. */
export const emptyPrice: Price = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };
