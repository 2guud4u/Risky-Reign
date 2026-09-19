import React, { useEffect, useRef, useState } from 'react';
import { CityPrice, RoadPrice, SettlementPrice, SoldierPrice, ResourceKey, RESOURCES } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { SPEND_DURATION, SPEND_STAGGER } from '../constants';
import { FlyIcon, nextIconId, toScreen, FlyIconView, resolveResourceAnchor } from './FlyIcon';

export type BuildType = 'settlement' | 'city' | 'road' | 'soldier';

export interface BuildAnimationInfo {
  type: BuildType;
  locationId: string;
}

export const BUILD_ANIMATION_EVENT = 'build:animation';

/**
 * Dispatch a build animation event so the ResourceSpendLayer can animate the
 * spent resources flying from the resource panel to the build location.
 */
export const triggerBuildAnimation = (info: BuildAnimationInfo): void => {
  window.dispatchEvent(new CustomEvent(BUILD_ANIMATION_EVENT, { detail: info }));
};

/** Map a build type to its resource cost. */
const PRICE_BY_TYPE: Record<BuildType, Partial<Record<ResourceKey, number>>> = {
  settlement: SettlementPrice,
  city: CityPrice,
  road: RoadPrice,
  soldier: SoldierPrice,
};

/**
 * Overlay that animates resource spends: when the current player builds
 * something (a settlement, city, road, or soldier), the spent resources fly
 * from the resource panel to the location where the building was placed.
 */
const ResourceSpendLayer: React.FC = () => {
  const { gameRoom } = useGameRoom();
  const gameRoomRef = useRef(gameRoom);
  gameRoomRef.current = gameRoom;
  const [icons, setIcons] = useState<FlyIcon[]>([]);

  const removeIcon = (id: number) => {
    setIcons((prev) => prev.filter((i) => i.id !== id));
  };

  useEffect(() => {
    const onBuild = (e: Event) => {
      const info = (e as CustomEvent<BuildAnimationInfo>).detail;
      const room = gameRoomRef.current;
      if (!room || !room.board) return;
      const board = room.board;
      const svg = document.querySelector<SVGSVGElement>('[data-board-svg]');
      if (!svg) return;

      // Resolve the target (build location) in SVG space.
      let target: { x: number; y: number } | null = null;
      if (info.type === 'road') {
        const edge = board.edges[info.locationId];
        if (edge) {
          const a = board.vertices[edge.vertexAId];
          const b = board.vertices[edge.vertexBId];
          if (a && b) {
            target = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
          }
        }
      } else {
        const vertex = board.vertices[info.locationId];
        if (vertex) target = { x: vertex.position.x, y: vertex.position.y };
      }
      if (!target) return;
      const screenTarget = toScreen(svg, target.x, target.y);
      if (!screenTarget) return;

      // Resolve the source (the "Your Resources" section when the Cards tab
      // is open, otherwise the Cards tab header).
      let source: { x: number; y: number } = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      resolveResourceAnchor((center) => { source = center; });

      // Create one icon per resource in the cost. Stagger them with a
      // running index (like the gain layer) so each resource flies after
      // the previous one instead of all launching at once and stacking.
      const price = PRICE_BY_TYPE[info.type];
      const newIcons: FlyIcon[] = [];
      let staggerIdx = 0;
      RESOURCES.forEach((k) => {
        const count = price[k] ?? 0;
        for (let i = 0; i < count; i++) {
          newIcons.push({
            id: nextIconId(),
            resource: k,
            sourceX: source.x,
            sourceY: source.y,
            targetX: screenTarget.x,
            targetY: screenTarget.y,
            delay: staggerIdx++ * SPEND_STAGGER,
          });
        }
      });
      setIcons((prev) => [...prev, ...newIcons]);
    };
    window.addEventListener(BUILD_ANIMATION_EVENT, onBuild);
    return () => window.removeEventListener(BUILD_ANIMATION_EVENT, onBuild);
  }, []);

  return (
    <>
      {icons.map((icon) => (
        <FlyIconView key={icon.id} icon={icon} duration={SPEND_DURATION} onDone={removeIcon} />
      ))}
    </>
  );
};

export default ResourceSpendLayer;
