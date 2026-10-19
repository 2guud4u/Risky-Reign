import { alphaBounds, autoSilhouette, bakePiece, previewPiece, type Rgba } from './bake';

/**
 * Stylus mask painter. Two alpha layers at source resolution — the roof
 * (tint) mask and the keep/remove silhouette — painted with pressure-sized
 * soft dabs. Preview runs the same bake + tint the game uses. Save writes
 * the layers (re-editable) and the cropped, downscaled game PNGs.
 */

interface PieceInfo {
  id: string;
  label: string;
  longSide: number;
  hasMask: boolean;
  hasSilhouette: boolean;
}

type LayerName = 'mask' | 'silhouette';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const view = $<HTMLCanvasElement>('view');
const vctx = view.getContext('2d')!;
const status = $<HTMLSpanElement>('status');
const sizeIn = $<HTMLInputElement>('size');
const hardIn = $<HTMLInputElement>('hard');
const overlayIn = $<HTMLInputElement>('overlay');
const colorIn = $<HTMLInputElement>('color');

const SWATCHES = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#f0e130', '#ffffff', '#222222'];
const UNDO_LIMIT = 40;

let piece: PieceInfo | null = null;
let srcImg: Rgba | null = null;
let srcCanvas: HTMLCanvasElement | null = null;
const layers: Record<LayerName, HTMLCanvasElement | null> = { mask: null, silhouette: null };
let active: LayerName = 'mask';
let erasing = false;
let preview = false;
let dirty = false;
let previewCanvas: HTMLCanvasElement | null = null;
let previewStale = true;

// View transform: screen = image * scale + offset.
let scale = 1;
let ox = 0;
let oy = 0;

const undo: { layer: LayerName; data: ImageData }[] = [];
const redo: { layer: LayerName; data: ImageData }[] = [];

const newCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const ctxOf = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;
const rgbaOf = (c: HTMLCanvasElement): Rgba => {
  const d = ctxOf(c).getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: c.width, height: c.height };
};
const canvasOf = (img: Rgba) => {
  const c = newCanvas(img.width, img.height);
  ctxOf(c).putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>();
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`failed to load ${src}`));
  img.src = src;
  return promise;
};

const setStatus = (s: string) => (status.textContent = s);
const markDirty = () => {
  dirty = true;
  previewStale = true;
  setStatus('unsaved changes');
};

// ---- loading ---------------------------------------------------------------

async function loadPiece(info: PieceInfo) {
  setStatus(`loading ${info.label}…`);
  piece = info;
  const src = await loadImage(`/api/pieces/${info.id}/source?t=${Date.now()}`);
  srcCanvas = newCanvas(src.naturalWidth, src.naturalHeight);
  ctxOf(srcCanvas).drawImage(src, 0, 0);
  srcImg = rgbaOf(srcCanvas);
  const { width: w, height: h } = srcCanvas;

  const layerFrom = async (name: LayerName, has: boolean, fallback: () => HTMLCanvasElement) => {
    if (!has) return fallback();
    const img = await loadImage(`/api/pieces/${info.id}/${name}?t=${Date.now()}`);
    const c = newCanvas(w, h);
    ctxOf(c).drawImage(img, 0, 0, w, h);
    return c;
  };
  layers.mask = await layerFrom('mask', info.hasMask, () => newCanvas(w, h));
  layers.silhouette = await layerFrom('silhouette', info.hasSilhouette, () => canvasOf(autoSilhouette(srcImg!)));
  undo.length = 0;
  redo.length = 0;
  dirty = false;
  previewStale = true;
  fit();
  setStatus(`${info.label} · ${w}×${h}${info.hasMask ? '' : ' · new mask'}`);
}

// ---- view ------------------------------------------------------------------

function resize() {
  const r = view.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  view.width = Math.round(r.width * dpr);
  view.height = Math.round(r.height * dpr);
  draw();
}

function fit() {
  if (!srcCanvas) return;
  const r = view.getBoundingClientRect();
  scale = Math.min(r.width / srcCanvas.width, r.height / srcCanvas.height) * 0.95;
  ox = (r.width - srcCanvas.width * scale) / 2;
  oy = (r.height - srcCanvas.height * scale) / 2;
  draw();
}

const checker = (() => {
  const c = newCanvas(16, 16);
  const x = ctxOf(c);
  x.fillStyle = '#9a9a9a';
  x.fillRect(0, 0, 16, 16);
  x.fillStyle = '#bdbdbd';
  x.fillRect(0, 0, 8, 8);
  x.fillRect(8, 8, 8, 8);
  return c;
})();

/** Fill a layer's alpha with a flat color, for the overlay tint. */
function colored(layer: HTMLCanvasElement, color: string) {
  const c = newCanvas(layer.width, layer.height);
  const x = ctxOf(c);
  x.drawImage(layer, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Source with the silhouette applied (removed area becomes transparent). */
function cutSource() {
  const c = newCanvas(srcCanvas!.width, srcCanvas!.height);
  const x = ctxOf(c);
  x.drawImage(srcCanvas!, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(layers.silhouette!, 0, 0);
  return c;
}

function buildPreview() {
  const baked = bakePiece(srcImg!, rgbaOf(layers.mask!), rgbaOf(layers.silhouette!));
  const hex = colorIn.value;
  const rgb: [number, number, number] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  previewCanvas = canvasOf(previewPiece(baked, rgb));
  previewStale = false;
}

let cursor: { x: number; y: number; r: number } | null = null;

function draw() {
  const dpr = window.devicePixelRatio || 1;
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.fillStyle = '#2b2b2b';
  vctx.fillRect(0, 0, view.width, view.height);
  if (!srcCanvas) return;
  vctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  vctx.imageSmoothingEnabled = scale < 2;
  const { width: w, height: h } = srcCanvas;
  vctx.fillStyle = vctx.createPattern(checker, 'repeat')!;
  vctx.fillRect(0, 0, w, h);

  if (preview) {
    if (previewStale) buildPreview();
    vctx.drawImage(previewCanvas!, 0, 0);
  } else {
    const ov = Number(overlayIn.value) / 100;
    if (active === 'silhouette') {
      // Removed area shows dimmed source under a magenta wash.
      vctx.globalAlpha = 1 - ov * 0.8;
      vctx.drawImage(srcCanvas, 0, 0);
      vctx.globalAlpha = 1;
      vctx.drawImage(cutSource(), 0, 0);
      const inv = newCanvas(w, h);
      const ix = ctxOf(inv);
      ix.fillStyle = '#ff00ff';
      ix.fillRect(0, 0, w, h);
      ix.globalCompositeOperation = 'destination-out';
      ix.drawImage(layers.silhouette!, 0, 0);
      vctx.globalAlpha = ov * 0.6;
      vctx.drawImage(inv, 0, 0);
    } else {
      vctx.drawImage(cutSource(), 0, 0);
      vctx.globalAlpha = ov;
      vctx.drawImage(colored(layers.mask!, colorIn.value), 0, 0);
    }
    vctx.globalAlpha = 1;
  }

  if (cursor) {
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vctx.beginPath();
    vctx.arc(cursor.x, cursor.y, Math.max(cursor.r * scale, 1.5), 0, Math.PI * 2);
    vctx.lineWidth = 2;
    vctx.strokeStyle = '#000';
    vctx.stroke();
    vctx.lineWidth = 1;
    vctx.strokeStyle = erasing ? '#ff6b6b' : '#fff';
    vctx.stroke();
  }
}

let raf = 0;
const requestDraw = () => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    draw();
  });
};

// ---- brush -----------------------------------------------------------------

const brushCache = new Map<string, HTMLCanvasElement>();
/** A white radial dab of radius r; hardness = share of the radius at full alpha. */
function dab(r: number) {
  const hard = Number(hardIn.value) / 100;
  const key = `${Math.round(r * 4)}:${hard}`;
  let c = brushCache.get(key);
  if (!c) {
    const d = Math.ceil(r * 2) + 2;
    c = newCanvas(d, d);
    const x = ctxOf(c);
    const g = x.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(Math.min(hard, 0.999), 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, d, d);
    if (brushCache.size > 400) brushCache.clear();
    brushCache.set(key, c);
  }
  return c;
}

function stamp(x: number, y: number, r: number, erase: boolean) {
  const layer = layers[active]!;
  const lx = ctxOf(layer);
  const b = dab(r);
  lx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  lx.drawImage(b, x - b.width / 2, y - b.height / 2);
  lx.globalCompositeOperation = 'source-over';
}

/** Pen pressure → radius. Mouse (no pressure, reports 0.5 while down) gets full size. */
function radiusFor(e: PointerEvent) {
  const base = Number(sizeIn.value) / 2;
  if (e.pointerType !== 'pen') return base;
  return Math.max(0.5, base * Math.pow(Math.max(e.pressure, 0.02), 0.8));
}

const toImage = (e: PointerEvent) => {
  const r = view.getBoundingClientRect();
  return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale };
};

let stroke: { x: number; y: number; r: number; erase: boolean } | null = null;
let pan: { x: number; y: number; ox: number; oy: number } | null = null;
let spaceDown = false;

function pushUndo() {
  const layer = layers[active]!;
  undo.push({ layer: active, data: ctxOf(layer).getImageData(0, 0, layer.width, layer.height) });
  if (undo.length > UNDO_LIMIT) undo.shift();
  redo.length = 0;
}

function swapHistory(from: typeof undo, to: typeof undo) {
  const entry = from.pop();
  if (!entry) return;
  const layer = layers[entry.layer]!;
  const x = ctxOf(layer);
  to.push({ layer: entry.layer, data: x.getImageData(0, 0, layer.width, layer.height) });
  x.putImageData(entry.data, 0, 0);
  markDirty();
  requestDraw();
}

view.addEventListener('pointerdown', (e) => {
  if (!srcCanvas) return;
  // Capture keeps the stroke alive when the pen leaves the canvas; it throws
  // for pointers the browser no longer tracks, which must not abort painting.
  try {
    view.setPointerCapture(e.pointerId);
  } catch {
    /* not capturable */
  }
  if (e.button === 1 || spaceDown) {
    pan = { x: e.clientX, y: e.clientY, ox, oy };
    return;
  }
  if (e.button !== 0 && !(e.pointerType === 'pen' && e.button === 5)) return;
  if (preview) return;
  // Pen eraser end reports button 5 / buttons 32.
  const erase = erasing || e.button === 5 || (e.buttons & 32) !== 0;
  pushUndo();
  const p = toImage(e);
  const r = radiusFor(e);
  stamp(p.x, p.y, r, erase);
  stroke = { ...p, r, erase };
  markDirty();
  requestDraw();
});

view.addEventListener('pointermove', (e) => {
  // Coalesced samples give the full pen path between frames; the list can be
  // empty (synthetic or some driver events), so fall back to the event itself.
  const coalesced = e.getCoalescedEvents?.() ?? [];
  const events = coalesced.length > 0 ? coalesced : [e];
  const last = events[events.length - 1];
  const rect = view.getBoundingClientRect();
  cursor = { x: last.clientX - rect.left, y: last.clientY - rect.top, r: radiusFor(last) };
  if (pan) {
    ox = pan.ox + e.clientX - pan.x;
    oy = pan.oy + e.clientY - pan.y;
    requestDraw();
    return;
  }
  if (stroke) {
    for (const ev of events) {
      const p = toImage(ev);
      const r = radiusFor(ev);
      // Space dabs at ~1/4 radius so pressure-tapered strokes stay solid.
      const dist = Math.hypot(p.x - stroke.x, p.y - stroke.y);
      const step = Math.max(0.5, Math.min(r, stroke.r) * 0.25);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        stamp(stroke.x + (p.x - stroke.x) * t, stroke.y + (p.y - stroke.y) * t, stroke.r + (r - stroke.r) * t, stroke.erase);
      }
      stroke = { ...p, r, erase: stroke.erase };
    }
  }
  requestDraw();
});

const endPointer = () => {
  stroke = null;
  pan = null;
};
view.addEventListener('pointerup', endPointer);
view.addEventListener('pointercancel', endPointer);
view.addEventListener('pointerleave', () => {
  cursor = null;
  requestDraw();
});
view.addEventListener('contextmenu', (e) => e.preventDefault());

view.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    const next = Math.min(40, Math.max(0.05, scale * k));
    ox = mx - ((mx - ox) * next) / scale;
    oy = my - ((my - oy) * next) / scale;
    scale = next;
    requestDraw();
  },
  { passive: false }
);

// ---- toolbar ---------------------------------------------------------------

function setLayer(name: LayerName) {
  active = name;
  $('layer-mask').classList.toggle('on', name === 'mask');
  $('layer-sil').classList.toggle('on', name === 'silhouette');
  requestDraw();
}
function setErase(on: boolean) {
  erasing = on;
  $('mode-paint').classList.toggle('on', !on);
  $('mode-erase').classList.toggle('on', on);
  requestDraw();
}
function setPreview(on: boolean) {
  preview = on;
  $('preview').classList.toggle('on', on);
  requestDraw();
}
const showSize = () => ($('size-v').textContent = sizeIn.value);

$('layer-mask').onclick = () => setLayer('mask');
$('layer-sil').onclick = () => setLayer('silhouette');
$('mode-paint').onclick = () => setErase(false);
$('mode-erase').onclick = () => setErase(true);
$('preview').onclick = () => setPreview(!preview);
$('undo').onclick = () => swapHistory(undo, redo);
$('redo').onclick = () => swapHistory(redo, undo);
$('save').onclick = () => void save();
sizeIn.oninput = () => {
  showSize();
  requestDraw();
};
hardIn.oninput = () => brushCache.clear();
overlayIn.oninput = requestDraw;
colorIn.oninput = () => {
  previewStale = true;
  requestDraw();
};
for (const c of SWATCHES) {
  const b = document.createElement('button');
  b.style.cssText = `width:20px;height:20px;padding:0;background:${c}`;
  b.title = c;
  b.onclick = () => {
    colorIn.value = c;
    previewStale = true;
    requestDraw();
  };
  $('swatches').append(b);
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    swapHistory(e.shiftKey ? redo : undo, e.shiftKey ? undo : redo);
  } else if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    void save();
  } else if (e.key === ' ') {
    spaceDown = true;
    e.preventDefault();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    setPreview(!preview);
  } else if (e.key === '1') setLayer('mask');
  else if (e.key === '2') setLayer('silhouette');
  else if (e.key === 'b') setErase(false);
  else if (e.key === 'e') setErase(true);
  else if (e.key === '0') fit();
  else if (e.key === '[' || e.key === ']') {
    const v = Number(sizeIn.value) * (e.key === ']' ? 1.2 : 1 / 1.2);
    sizeIn.value = String(Math.round(Math.min(200, Math.max(2, v))));
    showSize();
    requestDraw();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') spaceDown = false;
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});
window.addEventListener('resize', resize);

// ---- save ------------------------------------------------------------------

/** Crop to the piece and downscale so the long side is `longSide` (never up). */
function exportSized(img: Rgba, crop: { x: number; y: number; w: number; h: number }, longSide: number) {
  const full = canvasOf(img);
  const k = Math.min(1, longSide / Math.max(crop.w, crop.h));
  const out = newCanvas(Math.max(1, Math.round(crop.w * k)), Math.max(1, Math.round(crop.h * k)));
  const x = ctxOf(out);
  x.imageSmoothingQuality = 'high';
  x.drawImage(full, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

async function save() {
  if (!piece || !srcImg) return;
  setStatus('saving…');
  const sil = rgbaOf(layers.silhouette!);
  const crop = alphaBounds(sil);
  if (!crop) {
    setStatus('silhouette is empty — nothing to save');
    return;
  }
  const baked = bakePiece(srcImg, rgbaOf(layers.mask!), sil);
  const body = {
    maskLayer: layers.mask!.toDataURL('image/png'),
    silhouetteLayer: layers.silhouette!.toDataURL('image/png'),
    art: exportSized(baked.art, crop, piece.longSide),
    mask: exportSized(baked.mask, crop, piece.longSide),
  };
  const res = await fetch(`/api/pieces/${piece.id}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    setStatus(`save failed: ${await res.text()}`);
    return;
  }
  dirty = false;
  piece = { ...piece, hasMask: true, hasSilhouette: true };
  const { wrote } = (await res.json()) as { wrote: string[] };
  setStatus(`saved ${wrote.length} files · ${new Date().toLocaleTimeString()}`);
}

// ---- boot ------------------------------------------------------------------

async function boot() {
  showSize();
  resize();
  const list = (await (await fetch('/api/pieces')).json()) as PieceInfo[];
  const sel = $<HTMLSelectElement>('piece');
  for (const p of list) sel.append(new Option(p.label, p.id));
  sel.onchange = () => {
    const next = list.find((p) => p.id === sel.value);
    if (next && (!dirty || confirm('Discard unsaved changes?'))) void loadPiece(next);
    else if (piece) sel.value = piece.id;
  };
  if (list[0]) await loadPiece(list[0]);
}
void boot();

// Dev introspection for automated checks (harmless in this local-only tool).
declare global {
  interface Window {
    painter: { layer: (name: LayerName) => HTMLCanvasElement | null; view: () => { scale: number; ox: number; oy: number } };
  }
}
window.painter = {
  layer: (name) => layers[name],
  view: () => ({ scale, ox, oy }),
};
