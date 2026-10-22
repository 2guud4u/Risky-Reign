import { alphaBounds, autoSilhouette, bakePiece, previewPiece, type Rgba } from './bake';

/**
 * Stylus mask painter. Two alpha layers at source resolution — the player-color
 * (tint) mask and the keep/remove silhouette — painted with pressure-sized
 * soft dabs. Preview runs the same bake + tint the game uses. Save writes
 * the layers (re-editable) and the cropped, downscaled game PNGs.
 */

interface PieceInfo {
  id: string;
  label: string;
  longSide: number;
  /** Extra content shrink applied inside the output box (see pieces.ts). */
  figureScale?: number;
  /** Region of the source this piece uses; null = the whole image. */
  crop: { x: number; y: number; w: number; h: number } | null;
  hasMask: boolean;
  hasSilhouette: boolean;
  hasPaint: boolean;
}

type LayerName = 'mask' | 'silhouette' | 'paint';

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
const layers: Record<LayerName, HTMLCanvasElement | null> = { mask: null, silhouette: null, paint: null };
let active: LayerName = 'mask';
type Tool = 'paint' | 'erase' | 'bucket' | 'dropper';
let mode: Tool = 'paint';
let preDropMode: Exclude<Tool, 'dropper'> | null = null;
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
  // Pieces sharing a sheet work on their own crop; layers live at crop size.
  const c = info.crop ?? { x: 0, y: 0, w: src.naturalWidth, h: src.naturalHeight };
  srcCanvas = newCanvas(c.w, c.h);
  ctxOf(srcCanvas).drawImage(src, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
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
  layers.paint = await layerFrom('paint', info.hasPaint, () => newCanvas(w, h));
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

/** Source with the paint retouch layer composited over it. */
function effectiveArt() {
  if (!layers.paint) return srcCanvas!;
  const c = newCanvas(srcCanvas!.width, srcCanvas!.height);
  const x = ctxOf(c);
  x.drawImage(srcCanvas!, 0, 0);
  x.drawImage(layers.paint, 0, 0);
  return c;
}

/** Source with the silhouette applied (removed area becomes transparent). */
function cutSource() {
  const c = newCanvas(srcCanvas!.width, srcCanvas!.height);
  const x = ctxOf(c);
  x.drawImage(effectiveArt(), 0, 0);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(layers.silhouette!, 0, 0);
  return c;
}

function buildPreview() {
  const baked = bakePiece(srcImg!, rgbaOf(layers.mask!), rgbaOf(layers.silhouette!), rgbaOf(layers.paint!));
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
      vctx.drawImage(effectiveArt(), 0, 0);
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
    } else if (active === 'paint') {
      // Art layer shows the retouch composited over the cut source — no tint
      // overlay; what you see is what bakes.
      vctx.drawImage(cutSource(), 0, 0);
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
    vctx.strokeStyle = mode === 'erase' ? '#ff6b6b' : active === 'paint' ? colorIn.value : '#fff';
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
  if (active === 'paint' && !erase) {
    // Art layer is RGBA — tint the dab with the chosen color.
    const c = newCanvas(b.width, b.height);
    const cx = ctxOf(c);
    cx.drawImage(b, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = colorIn.value;
    cx.fillRect(0, 0, c.width, c.height);
    lx.drawImage(c, x - c.width / 2, y - c.height / 2);
    return;
  }
  lx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  lx.drawImage(b, x - b.width / 2, y - b.height / 2);
  lx.globalCompositeOperation = 'source-over';
}

/**
 * Bucket fill at image coords. Bounds: opaque dark pixels of the source art
 * (the black lines), plus — for the mask layer — the silhouette, so a fill
 * never leaks outside the figure. Paint mode also stops at already-painted
 * alpha; erase mode only flows through painted alpha (unpaints a region).
 * A 1px grow after the fill tucks the result under anti-aliased line edges.
 */
function bucketFill(x0: number, y0: number, erase: boolean) {
  const layer = layers[active]!;
  const w = layer.width;
  const h = layer.height;
  const sx = Math.floor(x0);
  const sy = Math.floor(y0);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

  const src = ctxOf(effectiveArt()).getImageData(0, 0, w, h).data;
  const dst = ctxOf(layer).getImageData(0, 0, w, h).data;
  // Mask is a sub-region of the figure — clip to silhouette when it exists.
  const sil = active === 'mask' && layers.silhouette
    ? ctxOf(layers.silhouette).getImageData(0, 0, w, h).data
    : null;

  const i4 = (x: number, y: number) => (y * w + x) * 4;
  // A pixel blocks paint if it's a dark line in the art or already painted.
  const blockedPaint = (i: number) => {
    const a = src[i + 3];
    const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    if (a > 64 && lum < 100) return true;
    if (dst[i + 3] > 0) return true;
    if (sil && sil[i + 3] <= 32) return true;
    return false;
  };
  // Erase flows through painted alpha; unpainted pixels and dark lines stop it.
  const blockedErase = (i: number) => dst[i + 3] === 0 || (src[i + 3] > 64 && 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2] < 100);

  const blocked = erase ? blockedErase : blockedPaint;
  const seed = i4(sx, sy);
  if (blocked(seed)) return;

  const seen = new Uint8Array(w * h);
  const stack = [sx, sy];
  seen[sy * w + sx] = 1;
  const filled: number[] = [];
  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    filled.push(i4(x, y));
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      if (blocked(i4(nx, ny))) continue;
      stack.push(nx, ny);
    }
  }
  // Grow 1px so the fill slips under soft line edges instead of leaving a
  // halo. Iterate a snapshot — pushing into `filled` while looping would
  // re-grow the grown pixels forever (that hung the tab).
  const extra: number[] = [];
  for (const i of filled) {
    const x = (i / 4) % w;
    const y = (i / 4 / w) | 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = i4(nx, ny);
      if (seen[(ni / 4) | 0] === 2) continue; // already grown in
      const a = src[ni + 3];
      const lum = 0.299 * src[ni] + 0.587 * src[ni + 1] + 0.114 * src[ni + 2];
      if (a > 200 && lum < 60) continue; // never grow into solid line cores
      if (sil && sil[ni + 3] <= 32) continue;
      seen[(ni / 4) | 0] = 2;
      extra.push(ni);
    }
  }
  filled.push(...extra);
  const img = ctxOf(layer).getImageData(0, 0, w, h);
  if (active === 'paint') {
    const hex = colorIn.value;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const i of filled) {
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
      img.data[i + 3] = erase ? 0 : 255;
    }
  } else {
    for (const i of filled) img.data[i + 3] = erase ? 0 : 255;
  }
  ctxOf(layer).putImageData(img, 0, 0);
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

/** Live touch pointers by pointerId — two of them means pinch, not paint. */
const touches = new Map<number, { x: number; y: number }>();
/** Pinch anchor: image point under the gesture midpoint + distance at start. */
let pinch: { d: number; ix: number; iy: number; s: number } | null = null;
/** After a pinch ends, remaining fingers must not resume painting. */
let liftSuppression = false;

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
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) {
      // Second finger: abandon any dab the first finger started, then pinch.
      if (stroke) { stroke = null; const u = undo.pop(); if (u) ctxOf(layers[u.layer]!).putImageData(u.data, 0, 0); }
      pan = null;
      const [a, b] = [...touches.values()];
      const rect = view.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ix: (mx - ox) / scale, iy: (my - oy) / scale, s: scale };
      liftSuppression = true;
      requestDraw();
      return;
    }
    if (liftSuppression) return;
  }
  if (pinch) return; // a pen/mouse press mid-pinch is noise
  if (e.button === 1 || spaceDown) {
    pan = { x: e.clientX, y: e.clientY, ox, oy };
    return;
  }
  if (e.button !== 0 && !(e.pointerType === 'pen' && e.button === 5)) return;
  if (preview) return;
  if (mode === 'dropper') {
    const p = toImage(e);
    const art = rgbaOf(effectiveArt());
    const i = (Math.floor(p.y) * art.width + Math.floor(p.x)) * 4;
    if (i >= 0 && i + 2 < art.data.length) {
      const h = (v: number) => v.toString(16).padStart(2, '0');
      colorIn.value = `#${h(art.data[i])}${h(art.data[i + 1])}${h(art.data[i + 2])}`;
      previewStale = true;
    }
    setMode(preDropMode ?? 'paint');
    preDropMode = null;
    return;
  }
  if (mode === 'bucket') {
    pushUndo();
    const p = toImage(e);
    bucketFill(p.x, p.y, e.button === 5 || (e.buttons & 32) !== 0);
    markDirty();
    requestDraw();
    return;
  }
  // Pen eraser end reports button 5 / buttons 32.
  const erase = mode === 'erase' || e.button === 5 || (e.buttons & 32) !== 0;
  pushUndo();
  const p = toImage(e);
  const r = radiusFor(e);
  stamp(p.x, p.y, r, erase);
  stroke = { ...p, r, erase };
  markDirty();
  requestDraw();
});

view.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  if (pinch && touches.size >= 2) {
    const [a, b] = [...touches.values()];
    const rect = view.getBoundingClientRect();
    const mx = (a.x + b.x) / 2 - rect.left;
    const my = (a.y + b.y) / 2 - rect.top;
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    // Zoom around the current midpoint; the anchored image point follows it,
    // so two-finger pan falls out of the same math.
    scale = Math.min(40, Math.max(0.05, pinch.s * (d / pinch.d)));
    ox = mx - pinch.ix * scale;
    oy = my - pinch.iy * scale;
    requestDraw();
    return;
  }
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

const endPointer = (e: PointerEvent) => {
  if (e.pointerType === 'touch') {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (touches.size === 0) liftSuppression = false;
  }
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
  $('layer-paint').classList.toggle('on', name === 'paint');
  requestDraw();
}
function setMode(m: Tool) {
  mode = m;
  $('mode-paint').classList.toggle('on', m === 'paint');
  $('mode-erase').classList.toggle('on', m === 'erase');
  $('mode-bucket').classList.toggle('on', m === 'bucket');
  $('mode-drop').classList.toggle('on', m === 'dropper');
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
$('layer-paint').onclick = () => setLayer('paint');
$('mode-paint').onclick = () => setMode('paint');
$('mode-erase').onclick = () => setMode('erase');
$('mode-bucket').onclick = () => setMode('bucket');
$('mode-drop').onclick = () => {
  if (mode !== 'dropper') preDropMode = mode;
  setMode('dropper');
};
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
  else if (e.key === '3') setLayer('paint');
  else if (e.key === 'b') setMode('paint');
  else if (e.key === 'e') setMode('erase');
  else if (e.key === 'f') setMode('bucket');
  else if (e.key === 'i') {
    if (mode !== 'dropper') { preDropMode = mode; setMode('dropper'); }
  }
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

/** Crop to the piece and downscale so the long side is `longSide` (never up).
 *  `figureScale` (<1) shrinks the content further inside the same box —
 *  bottom-aligned — for pieces whose figure was drawn too big at source. */
function exportSized(
  img: Rgba,
  crop: { x: number; y: number; w: number; h: number },
  longSide: number,
  figureScale = 1
) {
  const full = canvasOf(img);
  const k = Math.min(1, longSide / Math.max(crop.w, crop.h));
  const out = newCanvas(Math.max(1, Math.round(crop.w * k)), Math.max(1, Math.round(crop.h * k)));
  const x = ctxOf(out);
  x.imageSmoothingQuality = 'high';
  const dw = out.width * figureScale;
  const dh = out.height * figureScale;
  x.drawImage(full, crop.x, crop.y, crop.w, crop.h, (out.width - dw) / 2, out.height - dh, dw, dh);
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
  const baked = bakePiece(srcImg, rgbaOf(layers.mask!), sil, rgbaOf(layers.paint!));
  const body = {
    maskLayer: layers.mask!.toDataURL('image/png'),
    paintLayer: layers.paint!.toDataURL('image/png'),
    silhouetteLayer: layers.silhouette!.toDataURL('image/png'),
    art: exportSized(baked.art, crop, piece.longSide, piece.figureScale),
    mask: exportSized(baked.mask, crop, piece.longSide, piece.figureScale),
  };
  const res = await fetch(`/api/pieces/${piece.id}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    setStatus(`save failed: ${await res.text()}`);
    return;
  }
  dirty = false;
  piece = { ...piece, hasMask: true, hasSilhouette: true, hasPaint: true };
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
