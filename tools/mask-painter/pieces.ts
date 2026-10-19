/**
 * Pieces the mask painter can edit. Paths are repo-relative. The source is
 * never modified; the two layers are the re-editable paint (source
 * resolution, alpha = strength); outArt/outMask are the files the game's
 * tint bake (ui/src/utils/tintedArt.ts) loads.
 */
export interface PieceConfig {
  label: string;
  /** Unprocessed art (opaque, on its paper background). */
  source: string;
  /** Painted tint region, alpha = mask strength. */
  maskLayer: string;
  /** Painted keep/remove cutout, alpha = keep. */
  silhouetteLayer: string;
  outArt: string;
  outMask: string;
  /** Output long side in px (never upscaled). */
  longSide: number;
}

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
};
