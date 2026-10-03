import React from 'react';
import { Board } from 'common';
import SoldierGroup from '../SoldierGroup';
import { layoutGarrisonArmies } from '../../utils/garrisonFormation';
import { BOARD_SOLDIER_SCALE } from '../../constants';

interface BoardSoldiersProps {
  board: Board;
  /** Player name -> color, used to tint soldiers. */
  playerColors: Record<string, string>;
  /** Clicking a soldier selects its vertex (same as clicking its badge). */
  onSelect: (obj: { type: 'vertex'; id: string }) => void;
  /** The selected vertex: its soldiers are tapped to pick them instead. */
  selectedVertexId: string | null;
  /** Soldiers on the selected vertex the player may pick (marked with a bolt). */
  pickableSoldierIds: ReadonlySet<string>;
  /** Soldiers currently picked for a group action (outlined). */
  pickedSoldierIds: ReadonlySet<string>;
  /** Toggle a pickable soldier in/out of the group. */
  onSoldierClick: (soldierId: string) => void;
  /** Start dragging one soldier sprite (the Action-phase move). */
  onSoldierDragStart?: (e: React.MouseEvent, ownerName: string, vertexId: string, soldierId: string) => void;
}

/**
 * Zoomed-in soldier layer: each vertex's garrison drawn as a formation of
 * ranks (healthy soldiers in front, injured behind, count pill for the whole
 * army), standing below the vertex, scaled by BOARD_SOLDIER_SCALE about the
 * vertex so it fits the board's vertex spacing. Replaces the count badges
 * when the board is zoomed in. On the selected vertex, tapping one of your
 * soldiers that can still act picks or unpicks it for the soldier action
 * bubbles.
 */
export const BoardSoldiers = React.memo(function BoardSoldiers({
  board,
  playerColors,
  onSelect,
  selectedVertexId,
  pickableSoldierIds,
  pickedSoldierIds,
  onSoldierClick,
  onSoldierDragStart,
}: BoardSoldiersProps) {
  const vertexIds = new Set(Object.values(board.soldiers ?? {}).map((s) => s.vertexId));
  return (
    <>
      {[...vertexIds].map((vertexId) => {
        const vertex = board.vertices[vertexId];
        if (!vertex) return null;
        const { x, y } = vertex.position;
        const selected = vertexId === selectedVertexId;
        return (
          <g
            key={vertexId}
            // Scale the formation layout about the vertex so it fits the
            // board's vertex spacing (the layout already stands it below).
            transform={`translate(${x} ${y}) scale(${BOARD_SOLDIER_SCALE}) translate(${-x} ${-y})`}
            // Already selected: taps pick soldiers rather than re-selecting.
            onClick={selected ? undefined : () => onSelect({ type: 'vertex', id: vertexId })}
            style={{ cursor: selected ? undefined : 'pointer' }}
          >
            {layoutGarrisonArmies(board, vertex).map((a) => (
              <SoldierGroup
                key={a.ownerName}
                army={a}
                playerColors={playerColors}
                onSoldierClick={selected ? onSoldierClick : undefined}
                selectableSoldierIds={selected ? pickableSoldierIds : undefined}
                selectedSoldierIds={selected ? pickedSoldierIds : undefined}
                canActSoldierIds={selected ? pickableSoldierIds : undefined}
                onSoldierDragStart={onSoldierDragStart ? (e, ownerName, soldierId) => onSoldierDragStart(e, ownerName, vertexId, soldierId) : undefined}
              />
            ))}
          </g>
        );
      })}
    </>
  );
});
