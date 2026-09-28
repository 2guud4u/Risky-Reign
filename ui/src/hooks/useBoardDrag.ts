import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Board, BoardUIState, PublicGameRoom, PixelCoord, Player } from 'common';
import { DROP_THRESHOLD_FRACTION, PROJ_SIZE } from '../constants';
import { SelectableObject } from '../types';
import { SoldierDragState } from '../types/board';
import {
  isSoldierDraggable,
  mouseToSvgPoint,
  movableSoldierAt,
  nearestWithin,
  validSoldierTargets,
} from '../utils/boardInteraction';

/**
 * Board drag state machine: dragging your own soldiers between adjacent
 * vertices during the Action phase, and dragging the robber while a robber
 * move is pending. Also owns Escape handling (clears the selection and
 * cancels any in-progress drag) and the drop-resolution math.
 *
 * The callbacks are memoized and read current drag state through `stateRef`
 * so the memoized layer components (SoldierBadges etc.) get stable function
 * props — only the tiny drag-ghost overlay re-renders per mousemove, not the
 * whole board tree.
 */
export function useBoardDrag(opts: {
  board: Board | null;
  base: BoardUIState | null;
  gameRoom: PublicGameRoom | null;
  currentPlayer: Player | null;
  svgRef: React.RefObject<SVGSVGElement>;
  setSelectedObject: React.Dispatch<React.SetStateAction<SelectableObject | null>>;
  moveSoldier: (playerId: string, soldierId: string, targetVertexId: string, roomId: string) => void;
  moveRobber: (playerId: string, hexId: string, roomId: string) => void;
}) {
  const { board, base, gameRoom, currentPlayer, svgRef, setSelectedObject, moveSoldier, moveRobber } =
    opts;

  // Soldier drag-and-drop state.
  const [drag, setDrag] = useState<SoldierDragState | null>(null);
  const [mousePos, setMousePos] = useState<PixelCoord | null>(null);
  // Robber drag state: true while the user is dragging the robber.
  const [robberDrag, setRobberDrag] = useState(false);

  // Latest-values ref so the memoized callbacks read current drag state
  // without those values being in their dependency lists.
  const stateRef = useRef({ drag, mousePos, robberDrag });
  stateRef.current = { drag, mousePos, robberDrag };

  const cancelDrag = useCallback(() => {
    setDrag(null);
    setRobberDrag(false);
    setMousePos(null);
  }, []);

  // Escape clears the selection and cancels any in-progress soldier drag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      cancelDrag();
      setSelectedObject(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSelectedObject, cancelDrag]);

  // A pending robber move (a 7 roll or a played knight card) makes the
  // robber draggable for the pending player: dragging it to a valid hex
  // places it there.
  const robberPending = !!gameRoom?.robberMove && gameRoom.robberMove.player === currentPlayer?.name;
  const startRobberDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!robberPending) return;
      e.preventDefault(); // stop native drag + text selection highlight
      e.stopPropagation();
      setRobberDrag(true);
    },
    [robberPending]
  );

  /** Whether the current player may drag this owner's soldiers at a vertex. */
  const canDragSoldier = useCallback(
    (ownerName: string, vertexId: string): boolean =>
      isSoldierDraggable(gameRoom, currentPlayer?.name, ownerName, vertexId),
    [gameRoom, currentPlayer]
  );

  /** Start dragging the first movable soldier this owner has at the vertex. */
  const startDrag = useCallback(
    (e: React.MouseEvent, ownerName: string, vertexId: string) => {
      if (!board || !gameRoom) return;
      const soldier = movableSoldierAt(board, gameRoom, vertexId, ownerName);
      if (!soldier) return;
      e.preventDefault(); // stop native drag + text selection highlight
      e.stopPropagation();
      setDrag({
        soldierId: soldier.id,
        ownerName,
        fromVertexId: vertexId,
        validTargets: validSoldierTargets(board, vertexId),
      });
    },
    [board, gameRoom]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { drag: d, robberDrag: r } = stateRef.current;
      if (!d && !r) return;
      setMousePos(mouseToSvgPoint(e, svgRef.current));
    },
    [svgRef]
  );

  const handleMouseUp = useCallback(() => {
    const { drag: d, mousePos: mp, robberDrag: rd } = stateRef.current;
    // Handle robber drag.
    if (rd) {
      setRobberDrag(false);
      if (mp && board && currentPlayer && gameRoom) {
        // Drop on the nearest valid hex (non-Desert, no robber) within reach.
        const threshold = PROJ_SIZE * DROP_THRESHOLD_FRACTION;
        const target = nearestWithin(
          Object.values(base?.hexes ?? {}).filter((h) => h.terrain !== 'Desert' && !h.hasRobber),
          mp,
          threshold,
          (hex) => hex.position
        );
        if (target) {
          moveRobber(currentPlayer.id, target.id, gameRoom.id);
        }
      }
      setMousePos(null);
      return;
    }
    // Handle soldier drag.
    if (!d || !mp || !board || !currentPlayer || !gameRoom) {
      cancelDrag();
      return;
    }
    // Drop on the nearest valid target vertex within reach.
    const threshold = PROJ_SIZE * DROP_THRESHOLD_FRACTION;
    const target = nearestWithin(
      d.validTargets,
      mp,
      threshold,
      (tid) => board.vertices[tid]?.position ?? null
    );
    if (target) {
      moveSoldier(currentPlayer.id, d.soldierId, target, gameRoom.id);
    }
    cancelDrag();
  }, [board, base, gameRoom, currentPlayer, moveRobber, moveSoldier, cancelDrag]);

  return {
    drag,
    robberDrag,
    mousePos,
    robberPending,
    canDragSoldier,
    startDrag,
    startRobberDrag,
    handleMouseMove,
    handleMouseUp,
    cancelDrag,
  };
}
