/**
 * Single source of truth for UI colors. `tailwind.config.js` spreads
 * `colors` into `theme.extend.colors`; TS/SVG code uses the flat `C` map.
 * Game data colors (terrain palette, player colors) stay in `common` —
 * this file is chrome/theme only.
 */

export const colors = {
  // Warm cream canvas — the game's "table". Every surface sits on this.
  canvas: { DEFAULT: '#faf6ef', raised: '#fdfaf4', sunken: '#f2ead8' },
  // Warm ink — replaces gray for text. Softer than pure black, warmer
  // than slate. `deep`/`darker` also serve as dark badge/edge fills in SVG.
  ink: { DEFAULT: '#2d2520', soft: '#5c5248', faint: '#9b9183', deep: '#222', darker: '#111' },
  white: '#ffffff',
  black: '#000000',
  // Dark panels floating over art (verdict banner, roll badges, mini-map pills).
  panel: { dark: '#111827', edge: '#9ca3af' },
  // The animated "your turn" ring's rainbow stops.
  glow: { yellow: '#fde047', pink: '#f472b6', violet: '#a78bfa', blue: '#38bdf8', green: '#4ade80' },
  // Gold — the primary accent. Buttons, highlights, "this is yours".
  gold: { DEFAULT: '#d4a017', deep: '#b8860b', soft: '#e8c547', pale: '#fdf2d0' },
  // Terracotta — warm secondary, used for warnings/warm states.
  clay: { DEFAULT: '#c06b4a', soft: '#d98f72', pale: '#fbe8de' },
  // Moss — bright green for success/go states.
  moss: { DEFAULT: '#7bec3e', soft: '#72f62b', pale: '#eef7e3' },
  // Sky — warm blue for info/neutral accents.
  sky: { DEFAULT: '#4a7ea8', soft: '#6f9fc4', pale: '#e3f0f8' },
  // Phase accents for the turn status bar: muted so white text reads
  // on them; same hue families — action pulls red (combat).
  phase: { setup: '#35799f', dice: '#c2921a', build: '#3f9924', action: '#c93a26' },
  // Alert — notification badges (chat, trade counts). Bright, urgent red.
  alert: { DEFAULT: '#e5342a', soft: '#f56b60' },

  // Board chrome — selection, hover, ghost states on the main SVG.
  board: {
    fallback: '#9b9183', // unowned piece tint fallback (== ink.faint)
    ghost: '#999',       // dimmed/unselectable strokes
    wood: '#8B4513',     // unowned road/settlement tint
    ship: '#8b5a2b',     // unowned ship tint
    hover: '#FFA500',    // interactive hover highlight
    select: '#FFD700',   // selected ring (== lit-hex gold)
    danger: '#eb1010',   // delete/attack ring
    line: '#383636',     // unowned edge stroke
    markerEdge: '#333',  // mini-map settlement outline
    black: '#000',       // hex border stroke
    white: '#fff',       // outlines, labels, badge strokes
    dim: '#666',         // vertex ghost
    litHex: '#FFD700',   // lit-up hex fill (== select)
    hexFill: '#FFF',     // plain hex face
    deep: '#0a2434',     // water shadow / dock inset
    bolt: '#facc15',     // action-points bolt
    boltEdge: '#92680e',
    check: '#16a34a',    // ready/valid green check + arrow
    checkSoft: '#22c55e',
    pointer: '#3b82f6',  // pointing-finger ring
    pointerRing: '#2563eb',
    puff: '#d8d2c8',     // build-animation smoke puff
    targetBlue: '#38bdf8',
    targetGreen: '#22c55e',
    targetGreenRing: '#16a34a',
    selectedAmber: '#f59e0b',
    selectedAmberPale: '#fef3c7',
    dicePip: '#2d2520',  // == ink.DEFAULT
  },

  // Fight replay layer (map choreography).
  fight: {
    ground: '#35502f',
    panel: '#111827',
    panelEdge: '#9ca3af',
    text: '#e5e7eb',
    line: '#dc2626',       // clash line + red verdict
    kill: '#f87171',
    wound: '#fbbf24',
    sack: '#86efac',
    miss: '#cbd5e1',
    flee: '#7dd3fc',
    outline: '#111',       // text paint-order stroke
    spark: '#fff2a8',
    sparkEdge: '#e11d48',
    ball: '#222',
    mark: '#fff',          // × mark
    badge: '#111827',
    stageBg: '#1a1916',    // replay overlay backdrop
    muted: '#6b7280',      // neighbor letter labels
    link: '#2563eb',
    selectedRing: '#f59e0b',
    selectedPale: '#fef3c7',
    ready: '#16a34a',
    readySoft: '#22c55e',
  },

  // Map editor chrome.
  editor: {
    emptyCellStroke: '#d1d5db',
    placedStroke: '#374151',
    hoverStroke: '#16a34a',
    selectedStroke: '#f59e0b',
    invalidStroke: '#dc2626',
    hexFallbackFill: '#eee',
    tokenFill: '#fff',
    tokenStroke: '#111',
    desertLabel: '#92400e',
    previewBlue: '#4363d8',
    water: '#0a2434',
    dockGeneric: '#b8895a',
    dockSpecial: '#8a5a30',
    border: '#111',
  },

  // Ports — the dock art drawn on the board.
  port: {
    faceFill: '#ffffff',
    genericFill: '#e0a32e',
    labelFill: '#33475b',
    pier: '#b08d57',
    pierEdge: '#6e5230',
    specialFill: '#4a90d9',
    stroke: '#2a3a4a',
  },

  // Misc chrome.
  wood: { from: '#a9713e', to: '#8f5c2d' }, // hand-tray gradient
  water: { fallback: '#38bdf8' }, // behind a missing/slow ocean texture
  neutral: { pale: '#eee', grey: '#ccc', dim: '#DDD' },
};

/**
 * Flat lookup for imperative code (SVG attrs, canvas). Keys are
 * `group.name` paths; a trailing DEFAULT means `colors[group].DEFAULT`.
 * @type {Record<string, string>}
 */
export const C = {};
for (const [group, v] of Object.entries(colors)) {
  if (typeof v === 'string') {
    C[group] = v;
    continue;
  }
  for (const [name, hex] of Object.entries(v)) {
    C[name === 'DEFAULT' ? group : `${group}.${name}`] = hex;
  }
}
