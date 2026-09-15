import React, { useEffect, useRef } from 'react';
import { ResourceKey } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';

/** A single resource icon flying from a source point to a target point. */
export interface FlyIcon {
  id: number;
  resource: ResourceKey;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  delay: number;
}

let nextId = 0;
export const nextIconId = (): number => nextId++;

/**
 * Convert an SVG-space point (the board's pre-projection coordinate space) to
 * screen coordinates using the SVG's current transform matrix. Returns null
 * if the SVG has no CTM (e.g. not yet laid out).
 */
export function toScreen(
  svg: SVGSVGElement,
  x: number,
  y: number
): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const p = pt.matrixTransform(ctm);
  return { x: p.x, y: p.y };
}

/**
 * Resolve the resource anchor point: the center of the "Your Resources"
 * section when the Cards tab is open, otherwise the center of the Cards tab
 * header (falling back to the screen center if neither is present).
 */
export function resolveResourceAnchor(
  onResolve: (center: { x: number; y: number }) => void
): void {
  const centerOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const section = document.querySelector('[data-resource-section]');
  if (section) {
    onResolve(centerOf(section));
    return;
  }
  const tab = document.querySelector('[data-cards-tab]');
  if (tab) {
    onResolve(centerOf(tab));
    return;
  }
  onResolve({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
}

/**
 * A resource icon that flies from its source point to the target point, then
 * reports itself done so the parent can remove it.
 */
export const FlyIconView: React.FC<{
  icon: FlyIcon;
  duration: number;
  onDone: (id: number) => void;
}> = ({ icon, duration, onDone }) => {
  const ref = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(
      [
        {
          transform: `translate(${icon.sourceX}px, ${icon.sourceY}px) scale(1)`,
          opacity: 1,
        },
        {
          transform: `translate(${icon.targetX}px, ${icon.targetY}px) scale(0.9)`,
          opacity: 1,
          offset: 0.85,
        },
        {
          transform: `translate(${icon.targetX}px, ${icon.targetY}px) scale(0.4)`,
          opacity: 0,
        },
      ],
      {
        duration,
        delay: icon.delay,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards',
      }
    );
    anim.onfinish = () => doneRef.current(icon.id);
    return () => anim.cancel();
  }, [icon, duration]);

  return (
    <div
      ref={ref}
      className="fixed left-0 top-0 z-[60] pointer-events-none will-change-transform"
      style={{ transform: `translate(${icon.sourceX}px, ${icon.sourceY}px)`, opacity: 0 }}
    >
      <span className="text-2xl drop-shadow">{RESOURCE_ICONS[icon.resource]}</span>
    </div>
  );
};
