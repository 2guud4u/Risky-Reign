import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { cubeToPixel, ResourceKey, RESOURCES } from 'common';
import { BOARD_CENTER, GAIN_DURATION, GAIN_STAGGER, PROJ_SIZE } from '../constants';
import { FlyIcon } from '../types/flyIcon';
import { nextIconId, toScreen, FlyIconView, resolveResourceAnchor } from './FlyIcon';


/**
 * Overlay that animates resource gains: when the current player gains
 * resources (from a dice roll, a robber steal, or any other source), the
 * gained cards fly from the source on the board to the resource anchor
 * (the "Your Resources" section when the Cards tab is open, otherwise the
 * Cards tab header).
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
      for (const k of RESOURCES) {
        const d = (res[k] ?? 0) - (prev[k] ?? 0);
        if (d > 0) gains[k] = d;
      }
    }
    const totalGained = RESOURCES.reduce(
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
          return cubeToPixel(BOARD_CENTER, PROJ_SIZE);
        }
        if (sourceKind === 'steal') {
          const robberHex = Object.values(gameRoom.board!.hexes).find(
            (h) => h.robber
          );
          if (robberHex) return cubeToPixel(robberHex.coord, PROJ_SIZE);
          return cubeToPixel(BOARD_CENTER, PROJ_SIZE);
        }
        return cubeToPixel(BOARD_CENTER, PROJ_SIZE);
      };

      const spawnIcons = (target: { x: number; y: number }) => {
        const newIcons: FlyIcon[] = [];
        let staggerIdx = 0;
        for (const k of RESOURCES) {
          const count = gains[k] ?? 0;
          if (count <= 0) continue;

          const sp = sourceFor(k);
          const screen = svg ? toScreen(svg, sp.x, sp.y) : null;
          const sx = screen ? screen.x : window.innerWidth / 2;
          const sy = screen ? screen.y : window.innerHeight / 2;

          for (let i = 0; i < count; i++) {
            newIcons.push({
              id: nextIconId(),
              resource: k,
              sourceX: sx,
              sourceY: sy,
              targetX: target.x,
              targetY: target.y,
              delay: staggerIdx++ * GAIN_STAGGER,
            });
          }
        }
        if (newIcons.length > 0) {
          setIcons((prevIcons) => [...prevIcons, ...newIcons]);
        }
      };

      // The icons fly to the resource anchor (the "Your Resources" section
      // when the Cards tab is open, otherwise the Cards tab header).
      resolveResourceAnchor(spawnIcons);
    }

    prevResources.current = { ...res };
    prevRollTotal.current = rollTotal;
    prevSteal.current = gameRoom.steal;
  }, [gameRoom, currentPlayer, rollTotal]);

  if (icons.length === 0) return null;

  return (
    <>
      {icons.map((icon) => (
        <FlyIconView key={icon.id} icon={icon} duration={GAIN_DURATION} onDone={removeIcon} />
      ))}
    </>
  );
};

export default ResourceGainLayer;
