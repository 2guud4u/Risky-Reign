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
  onRobberMouseDown,
  onWinRobberMouseDown,
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
  onRobberMouseDown: (e: React.MouseEvent) => void;
  onWinRobberMouseDown: (e: React.MouseEvent) => void;
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
            onRobberMouseDown={
              robberPending ? onRobberMouseDown : winPending ? onWinRobberMouseDown : undefined
            }
            robberDraggable={robberDraggable}
            litUp={litUp}
            onRobberHover={onRobberHover}
          />
        );
      })}
    </>
  );
});
