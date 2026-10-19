/**
 * Pure pixel math for the mask painter (no DOM, so it can run in tests).
 *
 * The game tints a piece by drawing its mask filled with the player color,
 * then drawing the art over it (ui/src/utils/tintedArt.ts). Given the source
 * pixel O, the painted mask strength m, the painted keep strength k and a
 * shade s (how dark the source is, so hay texture survives the tint), the
 * look we want over any board pixel B is:
 *
 *   R = k·[ m·C·(1−s) + (1−m)·O ] + (1−k)·B
 *
 * With the game's composite (art A,P over mask m' filled with C) this is
 * exact when
 *
 *   A  = k·(1 − m·(1−s))
 *   m' = k·m·(1−s) / (1 − A)        (0 when A = 1)
 *   P  = k·(1−m)·O / A              (anything when A = 0)
 *
 * so soft mask edges blend tint into the original pixels and soft silhouette
 * edges stay see-through, whatever color and board sit behind the piece.
 */

export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Rec. 601 luma of an sRGB pixel, 0..255. */
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Brightness that maps to the pure player color: the 90th percentile of luma
 * over strongly-masked pixels, so most of the hay reads as the color with its
 * darker strands as shading. Falls back to 200 when nothing is masked.
 */
export function shadeReference(src: Rgba, mask: Rgba): number {
  const hist = new Uint32Array(256);
  let n = 0;
  const d = src.data;
  for (let i = 0; i < d.length; i += 4) {
    if (mask.data[i + 3] < 128) continue;
    hist[Math.round(luma(d[i], d[i + 1], d[i + 2]))]++;
    n++;
  }
  if (n === 0) return 200;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * 0.9) return Math.max(v, 1);
  }
  return 255;
}

/**
 * Bake the shipped art + mask from source, mask layer and silhouette layer
 * (all the same size; only the layers' alpha is read).
 */
export function bakePiece(src: Rgba, mask: Rgba, sil: Rgba): { art: Rgba; mask: Rgba } {
  const { width, height } = src;
  const n = width * height * 4;
  const art = new Uint8ClampedArray(n);
  const outMask = new Uint8ClampedArray(n);
  const ref = shadeReference(src, mask);
  const s = src.data;
  for (let i = 0; i < n; i += 4) {
    const k = sil.data[i + 3] / 255;
    if (k === 0) continue;
    const m = mask.data[i + 3] / 255;
    const shade = 1 - Math.min(1, luma(s[i], s[i + 1], s[i + 2]) / ref);
    const tint = m * (1 - shade);
    const A = k * (1 - tint);
    if (A < 1) {
      outMask[i] = outMask[i + 1] = outMask[i + 2] = 255;
      outMask[i + 3] = Math.round(((k * tint) / (1 - A)) * 255);
    }
    if (A > 0) {
      const f = (k * (1 - m)) / A;
      art[i] = s[i] * f;
      art[i + 1] = s[i + 1] * f;
      art[i + 2] = s[i + 2] * f;
      art[i + 3] = Math.round(A * 255);
    }
  }
  return { art: { data: art, width, height }, mask: { data: outMask, width, height } };
}

/**
 * What the game shows: `bakePiece` output tinted with `color` the way
 * tintedArt.ts does it (mask filled with color, art drawn over), returned
 * straight-alpha.
 */
export function previewPiece(baked: { art: Rgba; mask: Rgba }, color: [number, number, number]): Rgba {
  const { width, height } = baked.art;
  const a = baked.art.data;
  const mk = baked.mask.data;
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i += 4) {
    const ma = mk[i + 3] / 255;
    const aa = a[i + 3] / 255;
    const alpha = aa + ma * (1 - aa);
    if (alpha === 0) continue;
    for (let c = 0; c < 3; c++) {
      out[i + c] = (a[i + c] * aa + color[c] * ma * (1 - aa)) / alpha;
    }
    out[i + 3] = Math.round(alpha * 255);
  }
  return { data: out, width, height };
}

/**
 * Starting silhouette: flood-fill the paper background in from the image
 * border (bright, low-saturation pixels that change little step to step)
 * and keep everything it can't reach. Returns alpha-only white RGBA.
 */
export function autoSilhouette(src: Rgba): Rgba {
  const { width: w, height: h, data: d } = src;
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const isPaper = (p: number) => {
    const i = p * 4;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) < 38 && Math.min(r, g, b) > 165;
  };
  const seed = (p: number) => {
    if (!bg[p] && isPaper(p)) {
      bg[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  const step = (from: number, to: number) => {
    if (bg[to] || !isPaper(to)) return;
    const i = from * 4;
    const j = to * 4;
    if (Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) >= 30) return;
    bg[to] = 1;
    queue[tail++] = to;
  };
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) step(p, p - 1);
    if (x < w - 1) step(p, p + 1);
    if (p >= w) step(p, p - w);
    if (p < w * (h - 1)) step(p, p + w);
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    out[i] = out[i + 1] = out[i + 2] = 255;
    out[i + 3] = bg[p] ? 0 : 255;
  }
  return { data: out, width: w, height: h };
}

/** Bounding box of pixels with alpha > 0, padded and clamped; null if empty. */
export function alphaBounds(img: Rgba, pad = 2): { x: number; y: number; w: number; h: number } | null {
  const { width: w, height: h, data: d } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
