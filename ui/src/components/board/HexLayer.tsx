import React from 'react';
import { BoardHex } from 'common';
import Hexagon from '../Hexagon';
import { PROJ_SIZE } from '../../constants';

/**
 * Hex tiles layer: terrain, number tokens and the robber — clickable while a
 * robber move is pending, lit up when their token matches the roll. Memoized so
 * pan/zoom, hover elsewhere, and drag ghost updates don't re-render every tile.
 */
export const HexLayer = React.memo(function HexLayer({
  hexes,
  robberPending,
  winPending,
  winTargetIds,
  rollTotal,
  onRobberPointerDown,
  onWinRobberPointerDown,
  onRobberClick,
  onHexClick,
  onRobberHover,
}: {
  hexes: BoardHex[];
  /** Pending robber move for the current player (makes valid hexes clickable). */
  robberPending: boolean;
  /** A won robber fight: the winner must move the robber to an adjacent hex. */
  winPending: boolean;
  /** The hex ids the post-win robber may be moved to (adjacent, non-desert). */
  winTargetIds: ReadonlySet<string>;
  /** Current roll total (both dice), or null before both dice are rolled. */
  rollTotal: number | null;
  onRobberPointerDown: (e: React.PointerEvent) => void;
  onWinRobberPointerDown: (e: React.PointerEvent) => void;
  /** Clicking the robber opens its action bubbles (attack / move). */
  onRobberClick: () => void;
  /** Clicking a highlighted hex while a robber move is pending places it. */
  onHexClick: (hexId: string) => void;
  onRobberHover: (hexId: string, hovering: boolean) => void;
}) {
  const robberDraggable = robberPending || winPending;
  return (
    <>
      {hexes.map((hex) => {
        const isRobberTarget =
          (robberPending && hex.terrain !== 'Desert' && !hex.hasRobber) ||
          (winPending && winTargetIds.has(hex.id));
        const litUp =
          rollTotal !== null &&
          hex.rollNumber === rollTotal &&
          hex.terrain !== 'Desert' &&
          hex.terrain !== 'Water';
        return (
          <Hexagon
            key={hex.id}
            hex={hex}
            size={PROJ_SIZE}
            highlight={isRobberTarget}
            onClick={isRobberTarget ? onHexClick : undefined}
            onRobberPointerDown={
              robberPending ? onRobberPointerDown : winPending ? onWinRobberPointerDown : undefined
            }
            onRobberClick={onRobberClick}
            robberDraggable={robberDraggable}
            litUp={litUp}
            onRobberHover={onRobberHover}
          />
        );
      })}
    </>
  );
});
