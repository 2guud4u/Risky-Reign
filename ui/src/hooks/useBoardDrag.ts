import React, { useCallback } from 'react';
import { Board, BoardUIState, PublicGameRoom, PixelCoord, Player } from 'common';
import { DROP_THRESHOLD_FRACTION, PROJ_SIZE } from '../constants';
import { SelectableObject } from '../types';
import { DragSettle, SoldierDragState } from '../types/board';
import { useGameActions } from '../contexts/GameContext';
import { nearestWithin } from '../utils/boardInteraction';
import {
  isSoldierDraggable,
  movableSoldierAt,
  robberPlacementTargets,
  robberTargets,
  soldierMovable,
  soldierMoveTargets,
} from '../board/selectors';
import { useDragMachine } from './useDragMachine';

/**
 * The drag kinds the board understands. Each kind is a small state payload;
 * the pointer mechanics (one-at-a-time sessions, primary-pointer guards,
 * Escape, the settle spring) live in `useDragMachine` — this file holds the
 * per-kind resolvers that decide what a drop does.
 */
type BoardDrag =
  | { kind: 'soldier'; data: SoldierDragState }
  | { kind: 'robber' }
  | { kind: 'robberWin' };

/**
 * Drag-and-drop on the board: soldiers along roads, the robber to a new hex,
 * and the post-robber-fight winner move. Game-rule resolvers are here; the
 * machine underneath is shared.
 *
 * The callbacks are memoized so the memoized layer components
 * (SoldierBadges etc.) get stable function props — only the tiny drag-ghost
 * overlay re-renders per mousemove, not the board.
 */
export function useBoardDrag(opts: {
  board: Board | null;
  base: BoardUIState | null;
  gameRoom: PublicGameRoom | null;
  currentPlayer: Player | null;
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** Written true while a piece drag is live, so the touch layer reads to suppress pinch/pan. */
  dragActiveRef: React.MutableRefObject<boolean>;
  setSelectedObject: React.Dispatch<React.SetStateAction<SelectableObject | null>>;
  moveSoldier: (soldierId: string, targetVertexId: string) => void;
  moveRobber: (hexId: string) => void;
  moveRobberAfterWin: (hexId: string) => void;
}) {
  const {
    board,
    base,
    gameRoom,
    currentPlayer,
    svgRef,
    setSelectedObject,
    moveSoldier,
    moveRobber,
    moveRobberAfterWin,
  } = opts;

  const { showToast } = useGameActions();

  const dropThreshold = PROJ_SIZE * DROP_THRESHOLD_FRACTION;

  /** What a drop does, per drag kind. Returns the settle landing (or null). */
  const resolveDrop = useCallback(
    (d: BoardDrag, mp: PixelCoord | null): Omit<DragSettle, 'from'> | null => {
      switch (d.kind) {
        case 'robberWin': {
          // Post-win robber move: drop on a valid adjacent hex.
          const fromHexId = gameRoom?.robberDefeatedBy?.fromHexId;
          if (!mp || !board || !currentPlayer || !gameRoom || !fromHexId) return null;
          const valid = robberTargets(board, fromHexId)
            .map((id) => base?.hexes[id])
            .filter((h): h is NonNullable<typeof h> => !!h);
          const target = nearestWithin(valid, mp, dropThreshold, (hex) => hex.position);
          if (target) moveRobberAfterWin(target.id);
          // Landed: spring to the target; missed: spring back to the robber's hex.
          const landAt = target?.position ?? base?.hexes[fromHexId]?.position;
          return landAt ? { kind: 'robber', to: landAt } : null;
        }
        case 'robber': {
          if (!mp || !board || !currentPlayer || !gameRoom) return null;
          // Drop on the nearest valid hex (non-Desert, no robber) within reach.
          const target = nearestWithin(
            robberPlacementTargets(board)
              .map((id) => base?.hexes[id])
              .filter((h): h is NonNullable<typeof h> => !!h),
            mp,
            dropThreshold,
            (hex) => hex.position
          );
          const home = Object.values(base?.hexes ?? {}).find((h) => h.hasRobber)?.position;
          if (target) moveRobber(target.id);
          const landAt = target?.position ?? home;
          return landAt ? { kind: 'robber', to: landAt } : null;
        }
        case 'soldier': {
          const s = d.data;
          if (!mp || !board || !currentPlayer || !gameRoom) return null;
          // Drop on the nearest valid target vertex within reach.
          const target = nearestWithin(
            s.validTargets,
            mp,
            dropThreshold,
            (tid) => board.vertices[tid]?.position ?? null
          );
          const ghostColor = gameRoom.players.find((p) => p.name === s.ownerName)?.color;
          if (target) {
            moveSoldier(s.soldierId, target);
            const landAt = board.vertices[target]?.position;
            return landAt ? { kind: 'soldier', to: landAt, color: ghostColor } : null;
          }
          // Invalid drop: the ghost snaps back to the soldier's own vertex.
          const home = board.vertices[s.fromVertexId]?.position;
          // Dropped near a vertex that isn't road-connected: explain the miss.
          // Drops on open water / empty space stay a silent snap-back.
          if (
            nearestWithin(Object.keys(board.vertices), mp, dropThreshold, (tid) =>
              board.vertices[tid]?.position ?? null
            )
          ) {
            showToast('Soldiers can only move along a road');
          }
          return home ? { kind: 'soldier', to: home, color: ghostColor } : null;
        }
      }
    },
    [board, base, gameRoom, currentPlayer, moveRobber, moveRobberAfterWin, moveSoldier, showToast, dropThreshold]
  );

  const machine = useDragMachine<BoardDrag>({
    svgRef,
    dragActiveRef: opts.dragActiveRef,
    onDrop: resolveDrop,
    onEscape: () => setSelectedObject(null),
  });
  const { drag, mousePos, settle, clearSettle, beginDrag, cancelDrag, handlePointerMove, handlePointerUp } =
    machine;

  // A pending robber move (a 7 roll or a played knight card) makes the
  // robber draggable for the pending player: dragging it to a valid hex
  // places it there.
  const robberPending = !!gameRoom?.robberMove && gameRoom.robberMove.player === currentPlayer?.name;
  const startRobberDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!robberPending) return;
      e.stopPropagation(); // see startDrag: keep the click, stop the pan
      beginDrag({ kind: 'robber' });
    },
    [robberPending, beginDrag]
  );

  // A won robber fight makes the robber draggable for the winner: dragging
  // it to an adjacent hex places it there (the move is part of the win).
  const winPending =
    !!gameRoom?.robberDefeatedBy && gameRoom.robberDefeatedBy.playerName === currentPlayer?.name;
  const startWinDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!winPending) return;
      e.stopPropagation(); // see startDrag: keep the click, stop the pan
      beginDrag({ kind: 'robberWin' });
    },
    [winPending, beginDrag]
  );

  /** Whether the current player may drag this owner's soldiers at a vertex. */
  const canDragSoldier = useCallback(
    (ownerName: string, vertexId: string): boolean =>
      isSoldierDraggable(gameRoom, currentPlayer?.name, ownerName, vertexId),
    [gameRoom, currentPlayer]
  );

  const beginSoldierDrag = useCallback(
    (soldierId: string, ownerName: string, vertexId: string) => {
      if (!board) return;
      beginDrag({
        kind: 'soldier',
        data: {
          soldierId,
          ownerName,
          fromVertexId: vertexId,
          validTargets: soldierMoveTargets(board, vertexId),
        },
      });
    },
    [board, beginDrag]
  );

  /** Start dragging the first movable soldier this owner has at the vertex. */
  const startDrag = useCallback(
    (e: React.PointerEvent, ownerName: string, vertexId: string) => {
      const soldier = movableSoldierAt(gameRoom, ownerName, vertexId);
      if (!soldier) return;
      // No preventDefault: it would suppress the compatibility click on
      // touch (tap-to-select would die). The svg's onDragStart guard already
      // stops the native image drag.
      e.stopPropagation();
      beginSoldierDrag(soldier.id, ownerName, vertexId);
    },
    [gameRoom, beginSoldierDrag]
  );

  /** Start dragging a specific soldier (the zoomed-in sprite layer). */
  const startDragSoldier = useCallback(
    (e: React.PointerEvent, ownerName: string, vertexId: string, soldierId: string) => {
      if (!board || !gameRoom) return;
      // Same gate as the badge layer: own Action phase, own troops, still
      // movable this turn (one action per soldier per phase).
      if (!isSoldierDraggable(gameRoom, currentPlayer?.name, ownerName, vertexId)) return;
      const soldier = board.soldiers[soldierId];
      if (!soldier || soldier.owner !== ownerName || !soldierMovable(soldier, gameRoom)) return;
      // See startDrag: keep the click, stop the pan.
      e.stopPropagation();
      beginSoldierDrag(soldier.id, ownerName, vertexId);
    },
    [board, gameRoom, currentPlayer?.name, beginSoldierDrag]
  );

  return {
    drag: drag?.kind === 'soldier' ? drag.data : null,
    robberDrag: drag?.kind === 'robber',
    mousePos,
    settle,
    clearSettle,
    robberPending,
    winPending,
    canDragSoldier,
    startDrag,
    startDragSoldier,
    startRobberDrag,
    startWinDrag,
    handlePointerMove,
    handlePointerUp,
    cancelDrag,
  };
}
