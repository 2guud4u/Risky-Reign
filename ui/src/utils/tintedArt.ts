import { useEffect, useState } from 'react';
import { TROOP_ART } from '../constants';

/**
 * Player-colored piece art. Each piece ships as two PNGs: the art with its
 * colorable region turned into a black shading overlay, and a mask that is
 * white where the player's color shows. They are baked together once per
 * (art, color) into a cached image URL, so a piece on screen is one plain
 * <image>/<img> — far cheaper to repaint while panning/zooming than an
 * SVG mask or a re-rasterized vector <use> per piece.
 */
export interface TintArt {
  href: string;
  maskHref: string;
}

export const SOLDIER_ART: TintArt = { href: '/art/soldier.png', maskHref: '/art/soldier_mask.png' };
export const INJURED_SOLDIER_ART: TintArt = {
  href: '/art/injuredSoldier.png',
  maskHref: '/art/injuredSoldier_mask.png',
};
export const SHIP_ART: TintArt = { href: '/art/pieces/ship.png', maskHref: '/art/pieces/ship_mask.png' };
export const SETTLEMENT_ART: TintArt = { href: '/art/settlement.png', maskHref: '/art/settlement_mask.png' };
export const CITY_ART: TintArt = { href: '/art/city.png', maskHref: '/art/city_mask.png' };
export const CANNON_STATIONED_ART: TintArt = {
  href: '/art/pieces/cannon_stationed.png',
  maskHref: '/art/pieces/cannon_stationed_mask.png',
};
export const CANNON_UNSTATIONED_ART: TintArt = {
  href: '/art/pieces/cannon_unstationed.png',
  maskHref: '/art/pieces/cannon_unstationed_mask.png',
};

/**
 * Wall art: one sprite per hex-edge orientation, cut from one sheet drawn at
 * a single scale and light (art-src/wall.png via tools/mask-painter). Each
 * keeps the angle it was drawn at so its perspective and shading stay right;
 * the board picks the sprite closest to perpendicular and rotates only the
 * few-degree remainder.
 */
export interface WallSprite {
  art: TintArt;
  /** Sprite pixel size. */
  w: number;
  h: number;
  /** Screen angle (degrees, y down) of the wall's long axis as drawn. */
  axisDeg: number;
  /** Pixel on the wall's ground-level centerline, midway along its length:
   *  the point that sits on the road's midpoint. */
  anchorX: number;
  anchorY: number;
}

export const WALL_SPRITES: WallSprite[] = [
  {
    art: { href: '/art/pieces/wall_90.png', maskHref: '/art/pieces/wall_90_mask.png' },
    w: 371,
    h: 216,
    axisDeg: 0,
    anchorX: 184,
    anchorY: 164,
  },
  {
    art: { href: '/art/pieces/wall_30.png', maskHref: '/art/pieces/wall_30_mask.png' },
    w: 294,
    h: 430,
    axisDeg: -55,
    anchorX: 198,
    anchorY: 235,
  },
  {
    art: { href: '/art/pieces/wall_150.png', maskHref: '/art/pieces/wall_150_mask.png' },
    w: 291,
    h: 437,
    axisDeg: 55,
    anchorX: 82,
    anchorY: 243,
  },
];
/** The horizontal sprite's end-to-end length (px): the reference that sets
 *  the one board scale all wall sprites share. */
export const WALL_REFERENCE_LENGTH_PX = 366;
/** The sprite each troop kind draws with (sizes: `TROOP_ART` in constants). */
export const TROOP_SPRITES: Record<keyof typeof TROOP_ART, TintArt> = {
  soldier: SOLDIER_ART,
  injured: INJURED_SOLDIER_ART,
  cannonStationed: CANNON_STATIONED_ART,
  cannonUnstationed: CANNON_UNSTATIONED_ART,
};

const images = new Map<string, Promise<HTMLImageElement>>();
const baked = new Map<string, Promise<string>>();
/** Settled bake results, readable synchronously so remounts don't flash. */
const ready = new Map<string, string>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>();
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
    p = promise;
  }
  return p;
}

async function bake(art: TintArt, color: string): Promise<string> {
  const [base, mask] = await Promise.all([loadImage(art.href), loadImage(art.maskHref)]);
  const canvas = document.createElement('canvas');
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  // Color the mask's white area, then lay the shaded art over it.
  ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(base, 0, 0);
  const { promise, resolve } = Promise.withResolvers<Blob | null>();
  canvas.toBlob(resolve);
  const blob = await promise;
  if (!blob) throw new Error(`Failed to tint ${art.href}`);
  return URL.createObjectURL(blob);
}

/**
 * URL of `art` tinted with `color`, or null on the first render while the
 * bake runs (callers draw nothing for that frame). Every caller with the
 * same art + color shares one bake and one image URL.
 */
export function useTintedArt(art: TintArt, color: string): string | null {
  const key = `${art.href}|${color}`;
  const [url, setUrl] = useState<string | null>(() => ready.get(key) ?? null);
  useEffect(() => {
    const cached = ready.get(key);
    if (cached) {
      setUrl(cached);
      return;
    }
    setUrl(null);
    let p = baked.get(key);
    if (!p) {
      p = bake(art, color).then((u) => {
        ready.set(key, u);
        return u;
      });
      // A failed bake must not stay cached forever.
      p.catch(() => baked.delete(key));
      baked.set(key, p);
    }
    let live = true;
    p.then((u) => live && setUrl(u)).catch(() => {});
    return () => {
      live = false;
    };
    // `key` covers art.href + color; maskHref is fixed per art.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}
