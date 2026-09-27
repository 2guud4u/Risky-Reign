import React, { useEffect, useState } from 'react';
import { Board, BoardUIState, GameRoom, PixelCoord, Player } from 'common';
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
 */
export function useBoardDrag(opts: {
  board: Board | null;
  base: BoardUIState | null;
  gameRoom: GameRoom | null;
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

  const cancelDrag = () => {
    setDrag(null);
    setRobberDrag(false);
    setMousePos(null);
  };

  // Escape clears the selection and cancels any in-progress soldier drag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      cancelDrag();
      setSelectedObject(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSelectedObject]);

  // A pending robber move (a 7 roll or a played knight card) makes the
  // robber draggable for the pending player: dragging it to a valid hex
  // places it there.
  const robberPending = !!gameRoom?.robberMove && gameRoom.robberMove.player === currentPlayer?.name;
  const startRobberDrag = (e: React.MouseEvent) => {
    if (!robberPending) return;
    e.stopPropagation();
    setRobberDrag(true);
  };

  /** Whether the current player may drag this owner's soldiers at a vertex. */
  const canDragSoldier = (ownerName: string, vertexId: string): boolean =>
    isSoldierDraggable(gameRoom, currentPlayer?.name, ownerName, vertexId);

  /** Start dragging the first movable soldier this owner has at the vertex. */
  const startDrag = (e: React.MouseEvent, ownerName: string, vertexId: string) => {
    if (!board || !gameRoom) return;
    const soldier = movableSoldierAt(board, gameRoom, vertexId, ownerName);
    if (!soldier) return;
    e.stopPropagation();
    setDrag({
      soldierId: soldier.id,
      ownerName,
      fromVertexId: vertexId,
      validTargets: validSoldierTargets(board, vertexId),
    });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag && !robberDrag) return;
    setMousePos(mouseToSvgPoint(e, svgRef.current));
  };

  const handleMouseUp = () => {
    // Handle robber drag.
    if (robberDrag) {
      setRobberDrag(false);
      if (mousePos && board && currentPlayer && gameRoom) {
        // Drop on the nearest valid hex (non-Desert, no robber) within reach.
        const threshold = PROJ_SIZE * DROP_THRESHOLD_FRACTION;
        const target = nearestWithin(
          Object.values(base?.hexes ?? {}).filter((h) => h.terrain !== 'Desert' && !h.hasRobber),
          mousePos,
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
    if (!drag || !mousePos || !board || !currentPlayer || !gameRoom) {
      cancelDrag();
      return;
    }
    // Drop on the nearest valid target vertex within reach.
    const threshold = PROJ_SIZE * DROP_THRESHOLD_FRACTION;
    const target = nearestWithin(
      drag.validTargets,
      mousePos,
      threshold,
      (tid) => board.vertices[tid]?.position ?? null
    );
    if (target) {
      moveSoldier(currentPlayer.id, drag.soldierId, target, gameRoom.id);
    }
    cancelDrag();
  };

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
