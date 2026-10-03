import React from 'react';
import { Board } from 'common';
import SoldierGroup from '../SoldierGroup';
import { layoutGarrisonClusters } from '../../utils/miniMap';
import { BOARD_SOLDIER_SCALE } from '../../constants';

interface BoardSoldiersProps {
  board: Board;
  /** Player name -> color, used to tint soldiers. */
  playerColors: Record<string, string>;
  /** Clicking a soldier selects its vertex (same as clicking its badge). */
  onSelect: (obj: { type: 'vertex'; id: string }) => void;
}

/**
 * Zoomed-in soldier layer: each vertex's garrison drawn as individual soldiers,
 * exactly like the mini view (same cluster layout and soldier art), shrunk by
 * BOARD_SOLDIER_SCALE around the vertex so it fits the board's vertex spacing.
 * Replaces the count badges when the board is zoomed in.
 */
export const BoardSoldiers = React.memo(function BoardSoldiers({
  board,
  playerColors,
  onSelect,
}: BoardSoldiersProps) {
  const vertexIds = new Set(Object.values(board.soldiers ?? {}).map((s) => s.vertexId));
  return (
    <>
      {[...vertexIds].map((vertexId) => {
        const vertex = board.vertices[vertexId];
        if (!vertex) return null;
        const { x, y } = vertex.position;
        return (
          <g
            key={vertexId}
            // Scale the mini-view layout about the vertex.
            transform={`translate(${x} ${y}) scale(${BOARD_SOLDIER_SCALE}) translate(${-x} ${-y})`}
            onClick={() => onSelect({ type: 'vertex', id: vertexId })}
            style={{ cursor: 'pointer' }}
          >
            {layoutGarrisonClusters(board, vertex).map((c) => (
              <SoldierGroup
                key={c.ownerName}
                group={c.group}
                ownerName={c.ownerName}
                playerColors={playerColors}
                anchor={c.anchor}
                flip={c.anchor.x < x}
              />
            ))}
          </g>
        );
      })}
    </>
  );
});
