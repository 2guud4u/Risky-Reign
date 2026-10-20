/**
 * Pieces the mask painter can edit. Paths are repo-relative. The source is
 * never modified; the two layers are the re-editable paint (crop resolution,
 * alpha = strength); outArt/outMask are the files the game's tint bake
 * (ui/src/utils/tintedArt.ts) loads.
 */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PieceConfig {
  label: string;
  /** Unprocessed art (opaque, on its paper background). */
  source: string;
  /** Region of `source` this piece uses (whole image when omitted), so one
   *  sheet can hold several pieces. Layers are stored at this size. */
  crop?: CropRect;
  /** Painted tint region, alpha = mask strength. */
  maskLayer: string;
  /** Painted keep/remove cutout, alpha = keep. */
  silhouetteLayer: string;
  outArt: string;
  outMask: string;
  /** Output long side in px (never upscaled). */
  longSide: number;
}

/** One wall per hex-edge orientation, all cut from one sheet (same scale and
 *  light). Named by the screen angle of the road the wall crosses. Exported
 *  at native crop size (longSide exceeds every crop). */
const wall = (id: string, label: string, crop: CropRect): PieceConfig => ({
  label,
  source: 'art-src/wall.png',
  crop,
  maskLayer: `art-src/${id}.mask.png`,
  silhouetteLayer: `art-src/${id}.silhouette.png`,
  outArt: `ui/public/art/pieces/${id}.png`,
  outMask: `ui/public/art/pieces/${id}_mask.png`,
  longSide: 512,
});

export const PIECES: Record<string, PieceConfig> = {
  settlement: {
    label: 'Settlement (village)',
    source: 'art-src/settlement.jpg',
    maskLayer: 'art-src/settlement.mask.png',
    silhouetteLayer: 'art-src/settlement.silhouette.png',
    outArt: 'ui/public/art/settlement.png',
    outMask: 'ui/public/art/settlement_mask.png',
    longSide: 512,
  },
  wall_90: wall('wall_90', 'Wall — horizontal (vertical road)', { x: 8, y: 203, w: 384, h: 228 }),
  wall_30: wall('wall_30', 'Wall — rising / (road at 30°)', { x: 399, y: 60, w: 304, h: 440 }),
  wall_150: wall('wall_150', 'Wall — falling \\ (road at 150°)', { x: 705, y: 61, w: 302, h: 448 }),
};
