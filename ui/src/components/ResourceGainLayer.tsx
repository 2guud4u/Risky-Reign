import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { cubeToPixel, ResourceKey } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import { PROJ_SIZE } from '../constants';

/** A single resource icon flying from a source point to the resource panel. */
interface FlyIcon {
  id: number;
  resource: ResourceKey;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  delay: number;
}

const DURATION = 5000; // ms per card flight
const STAGGER = 110; // ms offset between successive cards
const CENTER = { q: 0, r: 0, s: 0 }; // board center (the desert hex)
const RESOURCE_KEYS: ResourceKey[] = ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore'];

let nextId = 0;

/**
 * Convert an SVG-space point (the board's pre-projection coordinate space) to
 * if the SVG has no CTM (e.g. not yet laid out).
 */
function toScreen(
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
 * A resource icon that flies from its source point to the target point, then
 * reports itself done so the parent can remove it.
 */
const FlyIconView: React.FC<{
  icon: FlyIcon;
  onDone: (id: number) => void;
}> = ({ icon, onDone }) => {
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
        duration: DURATION,
        delay: icon.delay,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards',
      }
    );
    anim.onfinish = () => doneRef.current(icon.id);
    return () => anim.cancel();
  }, [icon]);

  return (
    <div
      ref={ref}
      className="fixed left-0 top-0 z-[60] pointer-events-none will-change-transform"
      style={{ transform: `translate(${icon.sourceX}px, ${icon.sourceY}px)` }}
    >
      <span className="text-2xl drop-shadow">{RESOURCE_ICONS[icon.resource]}</span>
    </div>
  );
};

/**
 * Overlay that animates resource gains: when the current player gains
 * resources (from a dice roll, a robber steal, or any other source), the
 * gained cards fly from the source on the board to the resource panel.
 */
const ResourceGainLayer: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const [icons, setIcons] = useState<FlyIcon[]>([]);

  const prevResources = useRef<Record<string, number> | null>(null);
  const prevRollTotal = useRef<number | null>(null);
  const prevSteal = useRef<NonNullable<typeof gameRoom>['steal']>(null);

  const rollTotal =
    gameRoom && gameRoom.roll.die1 !== null && gameRoom.roll.die2 !== null
      ? gameRoom.roll.die1 + gameRoom.roll.die2
      : null;

  const removeIcon = useCallback(
    (id: number) => setIcons((prev) => prev.filter((i) => i.id !== id)),
    []
  );

  useEffect(() => {
    if (!gameRoom || !currentPlayer) return;
    const res = currentPlayer.resources;
    const prev = prevResources.current;

    // Gains = per-resource increases for the current player.
    const gains: Partial<Record<ResourceKey, number>> = {};
    if (prev) {
      for (const k of RESOURCE_KEYS) {
        const d = (res[k] ?? 0) - (prev[k] ?? 0);
        if (d > 0) gains[k] = d;
      }
    }
    const totalGained = RESOURCE_KEYS.reduce(
      (a, k) => a + (gains[k] ?? 0),
      0
    );

    // Cause inference from state transitions.
    const isDicePlayer = gameRoom.turnState.player === currentPlayer.name;
    const rollJustCompleted =
      prevRollTotal.current === null && rollTotal !== null;
    const stealJustResolved =
      prevSteal.current !== null &&
      prevSteal.current.thief === currentPlayer.name &&
      gameRoom.steal === null;

    let sourceKind: 'dice' | 'steal' | 'other' = 'other';
    if (isDicePlayer && rollJustCompleted) sourceKind = 'dice';
    else if (stealJustResolved) sourceKind = 'steal';



    if (totalGained > 0 && gameRoom.board) {
      // Target: the resource panel center (screen coords).
      const panel = document.querySelector('[data-resource-panel]');
      let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      if (panel) {
        const r = panel.getBoundingClientRect();
        target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      const svg = document.querySelector(
        '[data-board-svg]'
      ) as SVGSVGElement | null;

      // Per-resource source (SVG space).
      const sourceFor = (k: ResourceKey): { x: number; y: number } => {
        if (sourceKind === 'dice' && rollTotal !== null) {
          // The producing hex: matching token, a producing terrain, and a
          // settlement of the current player on it.
          for (const hex of Object.values(gameRoom.board!.hexes)) {
            if (hex.rollNumber !== rollTotal) continue;
            if (hex.terrain === 'Water' || hex.terrain === 'Desert') continue;
            if (hex.terrain !== k) continue;
            const hasSettlement = Object.values(gameRoom.board!.vertices).some(
              (v) =>
                v.hexIds.includes(hex.id) &&
                v.settlementId !== null &&
                gameRoom.board!.settlements[v.settlementId]?.ownerId ===
                  currentPlayer.name
            );
            if (hasSettlement) return cubeToPixel(hex.coord, PROJ_SIZE);
          }
          return cubeToPixel(CENTER, PROJ_SIZE);
        }
        if (sourceKind === 'steal') {
          const robberHex = Object.values(gameRoom.board!.hexes).find(
            (h) => h.robber
          );
          if (robberHex) return cubeToPixel(robberHex.coord, PROJ_SIZE);
          return cubeToPixel(CENTER, PROJ_SIZE);
        }
        return cubeToPixel(CENTER, PROJ_SIZE);
      };

      const newIcons: FlyIcon[] = [];
      let staggerIdx = 0;
      for (const k of RESOURCE_KEYS) {
        const count = gains[k] ?? 0;
        if (count <= 0) continue;

        const sp = sourceFor(k);
        const screen = svg ? toScreen(svg, sp.x, sp.y) : null;
        const sx = screen ? screen.x : window.innerWidth / 2;
        const sy = screen ? screen.y : window.innerHeight / 2;

        for (let i = 0; i < count; i++) {
          newIcons.push({
            id: nextId++,
            resource: k,
            sourceX: sx,
            sourceY: sy,
            targetX: target.x,
            targetY: target.y,
            delay: staggerIdx++ * STAGGER,
          });
        }
      }
      if (newIcons.length > 0) {
        setIcons((prevIcons) => [...prevIcons, ...newIcons]);
      }
    }

    prevResources.current = { ...res };
    prevRollTotal.current = rollTotal;
    prevSteal.current = gameRoom.steal;
  }, [gameRoom, currentPlayer, rollTotal]);

  if (icons.length === 0) return null;

  return (
    <>
      {icons.map((icon) => (
        <FlyIconView key={icon.id} icon={icon} onDone={removeIcon} />
      ))}
    </>
  );
};

export default ResourceGainLayer;
