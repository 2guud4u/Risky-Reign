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
  /** Extra shrink applied to the crop after the longSide fit, for pieces
   *  whose source figure is drawn bigger than its kin (e.g. injured soldier
   *  vs soldier). Content stays bottom-aligned inside the same box. */
  figureScale?: number;
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
  soldier: {
    label: 'Soldier — standing',
    source: 'art-src/soldier.png',
    maskLayer: 'art-src/soldier.mask.png',
    silhouetteLayer: 'art-src/soldier.silhouette.png',
    outArt: 'ui/public/art/soldier.png',
    outMask: 'ui/public/art/soldier_mask.png',
    longSide: 682,
  },
  injured: {
    label: 'Soldier — injured standing',
    source: 'art-src/injured.png',
    maskLayer: 'art-src/injured.mask.png',
    silhouetteLayer: 'art-src/injured.silhouette.png',
    outArt: 'ui/public/art/injuredSoldier.png',
    outMask: 'ui/public/art/injuredSoldier_mask.png',
    longSide: 682,
    // The source figure is drawn ~14% bigger than the soldier's; shrink it
    // back so injured and healthy troops match in-game.
    figureScale: 0.88,
  },
  cannonStationed: {
    label: 'Cannon — stationed',
    source: 'art-src/cannonStationed.png',
    maskLayer: 'art-src/cannonStationed.mask.png',
    silhouetteLayer: 'art-src/cannonStationed.silhouette.png',
    outArt: 'ui/public/art/pieces/cannon_stationed.png',
    outMask: 'ui/public/art/pieces/cannon_stationed_mask.png',
    longSide: 512,
  },
  cannonUnstationed: {
    label: 'Cannon — unstationed',
    source: 'art-src/cannonUnstationed.png',
    maskLayer: 'art-src/cannonUnstationed.mask.png',
    silhouetteLayer: 'art-src/cannonUnstationed.silhouette.png',
    outArt: 'ui/public/art/pieces/cannon_unstationed.png',
    outMask: 'ui/public/art/pieces/cannon_unstationed_mask.png',
    longSide: 512,
  },
  slash: {
    label: 'Battle — slash',
    source: 'art-src/slash.png',
    maskLayer: 'art-src/slash.mask.png',
    silhouetteLayer: 'art-src/slash.silhouette.png',
    outArt: 'ui/public/art/battle/slash.png',
    outMask: 'ui/public/art/battle/slash_mask.png',
    longSide: 816,
  },
  stabbed: {
    label: 'Battle — stabbed death',
    source: 'art-src/stabbed.png',
    maskLayer: 'art-src/stabbed.mask.png',
    silhouetteLayer: 'art-src/stabbed.silhouette.png',
    outArt: 'ui/public/art/battle/stabbed.png',
    outMask: 'ui/public/art/battle/stabbed_mask.png',
    longSide: 623,
  },
  stunned: {
    label: 'Battle — stunned',
    source: 'art-src/stunned.png',
    maskLayer: 'art-src/stunned.mask.png',
    silhouetteLayer: 'art-src/stunned.silhouette.png',
    outArt: 'ui/public/art/battle/stunned.png',
    outMask: 'ui/public/art/battle/stunned_mask.png',
    longSide: 678,
  },
  thrust: {
    label: 'Battle — spear thrust',
    source: 'art-src/thrust.png',
    maskLayer: 'art-src/thrust.mask.png',
    silhouetteLayer: 'art-src/thrust.silhouette.png',
    outArt: 'ui/public/art/battle/thrust.png',
    outMask: 'ui/public/art/battle/thrust_mask.png',
    longSide: 843,
  },
  injuredStabbed: {
    label: 'Battle — injured death',
    source: 'art-src/injuredStabbed.png',
    maskLayer: 'art-src/injuredStabbed.mask.png',
    silhouetteLayer: 'art-src/injuredStabbed.silhouette.png',
    outArt: 'ui/public/art/battle/injuredStabbed.png',
    outMask: 'ui/public/art/battle/injuredStabbed_mask.png',
    longSide: 640,
  },
  cannonFire: {
    label: 'Battle — cannon firing',
    source: 'art-src/cannonFire.png',
    maskLayer: 'art-src/cannonFire.mask.png',
    silhouetteLayer: 'art-src/cannonFire.silhouette.png',
    outArt: 'ui/public/art/battle/cannonFire.png',
    outMask: 'ui/public/art/battle/cannonFire_mask.png',
    longSide: 638,
  },
  cannonWreck: {
    label: 'Battle — cannon wreck',
    source: 'art-src/cannonWreck.png',
    maskLayer: 'art-src/cannonWreck.mask.png',
    silhouetteLayer: 'art-src/cannonWreck.silhouette.png',
    outArt: 'ui/public/art/battle/cannonWreck.png',
    outMask: 'ui/public/art/battle/cannonWreck_mask.png',
    longSide: 486,
  },
};
