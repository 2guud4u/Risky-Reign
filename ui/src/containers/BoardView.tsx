import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BOARD_RADIUS, domainToPresentation, BoardUIState } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { SoldierBadges } from '../components/SoldierBadges';
import { HexLayer } from '../components/board/HexLayer';
import { EdgeLayer, VertexLayer } from '../components/board/PieceLayers';
import { PortLayer } from '../components/board/PortLayer';
import { RobberBagPopup } from '../components/board/RobberBagPopup';
import { DragOverlays } from '../components/board/DragOverlays';
import { useBoardViewport } from '../hooks/useBoardViewport';
import { useBoardDrag } from '../hooks/useBoardDrag';
import {
  BOARD_MAX_SCALE,
  BOARD_MIN_SCALE,
  BOARD_RENDER_MARGIN,
  BOARD_VIEWBOX_MARGIN,
  PROJ_SIZE,
} from '../constants';
import { BoardViewProps } from '../types/board';
import {
  countSoldiersByVertexAndOwner,
  groupPortVertices,
  layerBoardInteraction,
} from '../utils/boardPresentation';

/**
 * Renders the board as an SVG of hexes / edges / vertices.
 *
 * The domain Board's vertex+edge positions are pre-projected by the backend
 * at GAME_HEX_SIZE, so we always convert at that size (PROJ_SIZE) to keep hex
 * and vertex coordinates consistent; the SVG viewBox/width scale the result
 * to the requested render size.
 *
 * The board is an inspect/interact surface: clicking a vertex or edge selects
 * it in the sidebar (which owns all building actions). It also supports
 * dragging your own soldiers between adjacent vertices during the Action
 * phase, panning (drag empty space) and zooming (wheel / double-click).
 * Escape clears the selection and cancels any in-progress drag.
 */
const BoardView: React.FC<BoardViewProps> = ({ hexSize }) => {
  const { gameRoom, currentPlayer, selectedObject, setSelectedObject } = useGameRoom();
  const { moveSoldier, moveRobber } = useSocket();

  const [hoveredVertexId, setHoveredVertexId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  // The hex whose robber is hovered (drives the robber-bag popup).
  const [hoveredRobberHexId, setHoveredRobberHexId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Responsive sizing: track the available container size so the board can
  // scale with panel resizes (clamped to BOARD_MIN/MAX_SCALE).
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const board = gameRoom?.board ?? null;
  // The current roll total (both dice rolled) — used to light up the hexes
  // whose token matches, so players can see which tiles produced.
  const roll = gameRoom?.roll;
  const rollTotal = roll && roll.die1 !== null && roll.die2 !== null ? roll.die1 + roll.die2 : null;

  // Presentation state: projected vertices/edges/hexes. The board is always
  // fully selectable — building is done from the sidebar, so nothing is
  // gated here.
  const base = useMemo<BoardUIState | null>(() => {
    if (!board) return null;
    const state = domainToPresentation(board, PROJ_SIZE);
    for (const v of Object.values(state.vertices)) v.isSelectable = true;
    for (const e of Object.values(state.edges)) e.isSelectable = true;
    return state;
  }, [board]);

  // Trade ports grouped into docks of 1-2 adjacent coastal vertices.
  const portGroups = useMemo(() => groupPortVertices(base), [base]);

  // Soldiers grouped by vertex, then by owner (for count badges).
  const soldierGroups = useMemo(() => countSoldiersByVertexAndOwner(board), [board]);

  // Pan/zoom over the board's coordinate space (viewBox-based).
  const span = (BOARD_RADIUS * 2 + 1) * Math.sqrt(3);
  // The margin leaves room past the hex ring so the trade ports (which sit in
  // the water beyond the board edge) are not clipped by the viewBox.
  const baseSize = BOARD_VIEWBOX_MARGIN * PROJ_SIZE * span;
  const viewport = useBoardViewport(svgRef, baseSize);

  // Drag state machine: soldier drags between adjacent vertices, the pending
  // robber move, Escape cancellation and drop resolution.
  const {
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
  } = useBoardDrag({
    board,
    base,
    gameRoom,
    currentPlayer,
    svgRef,
    setSelectedObject,
    moveSoldier,
    moveRobber,
  });

  const handleVertexClick = useCallback(
    (vertexId: string) => {
      setSelectedObject({ type: 'vertex', id: vertexId });
    },
    [setSelectedObject]
  );

  // `board` is non-null whenever `base` is (the memo derives from it).
  if (!base || !gameRoom || !board) {
    return <div className="text-center text-gray-500">Loading board...</div>;
  }
  // Map owner name -> chosen color so settlements/roads render in the
  // player's color.
  const colorOf = (ownerId: string | null): string | undefined =>
    !ownerId ? undefined : gameRoom.players.find((p) => p.name === ownerId)?.color;

  // Layer ephemeral interaction state (hover/select) and owner colors onto
  // the presentation.
  const { vertices, edges, hexes } = layerBoardInteraction(
    base,
    selectedObject,
    hoveredVertexId,
    hoveredEdgeId,
    colorOf
  );

  const handleEdgeClick = (edgeId: string) => {
    setSelectedObject({ type: 'edge', id: edgeId });
  };

  // The margin leaves room past the hex ring so the coast trade ports are not clipped.
  const naturalSize = BOARD_RENDER_MARGIN * hexSize * span;

  // Size the board to fit its container, clamped so it never becomes too
  // small or too large relative to its natural size. (Zooming on top of this
  // is handled by the viewBox via useBoardViewport.)
  let renderSize = naturalSize;
  if (containerSize && containerSize.w > 0 && containerSize.h > 0) {
    const scale = Math.min(containerSize.w / naturalSize, containerSize.h / naturalSize);
    const clampedScale = Math.max(BOARD_MIN_SCALE, Math.min(scale, BOARD_MAX_SCALE));
    renderSize = naturalSize * clampedScale;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: "url('/art/ocean.jpeg')",
          backgroundRepeat: 'repeat',
          backgroundColor: '#00FFFF',
        }}
      >
        {viewport.isDirty && (
          <button
            type="button"
            onClick={viewport.reset}
            className="absolute top-2 right-2 z-10 px-2.5 py-1 text-[12px] font-semibold rounded-md bg-white border border-gray-300 shadow cursor-pointer text-gray-600 hover:text-gray-900"
            title="Reset zoom and position"
          >
            Reset view
          </button>
        )}
        <svg
          ref={svgRef}
          data-board-svg="true"
          width={renderSize}
          height={renderSize}
          viewBox={viewport.viewBox}
          className="block w-full"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={cancelDrag}
          onMouseDown={viewport.onMouseDown}
          onDoubleClick={viewport.onDoubleClick}
        >
          {/* Hex tiles layer (clickable while a robber move is pending) */}
          <HexLayer
            hexes={hexes}
            robberPending={robberPending}
            rollTotal={rollTotal}
            onRobberMouseDown={startRobberDrag}
            onRobberHover={(hexId, hovering) => setHoveredRobberHexId(hovering ? hexId : null)}
          />

          {/* Edges layer */}
          <EdgeLayer edges={edges} onClick={handleEdgeClick} onHover={setHoveredEdgeId} />

          {/* Vertices layer */}
          <VertexLayer vertices={vertices} onClick={handleVertexClick} onHover={setHoveredVertexId} />

          {/* Robber's bag: dialog popup over the hovered robber (top layer so
              it isn't covered by the hexes). */}
          <RobberBagPopup hex={hexes.find((h) => h.id === hoveredRobberHexId) ?? null} />

          {/* Trade ports (harbors): one icon per dock, with a little road
              to each of the 1-2 vertices it serves. */}
          <PortLayer portGroups={portGroups} />

          {/* Soldiers layer: count badges below each vertex */}
          <SoldierBadges
            soldierGroups={soldierGroups}
            vertices={board.vertices}
            colorOf={colorOf}
            canDragSoldier={canDragSoldier}
            onDragStart={startDrag}
            onSelect={setSelectedObject}
          />

          {/* Drag feedback: drop-target rings and the cursor-following ghost */}
          <DragOverlays
            drag={drag}
            robberDrag={robberDrag}
            mousePos={mousePos}
            vertices={board.vertices}
            colorOf={colorOf}
          />
        </svg>
        {/* <image  href="/art/settlement.svg#settlement-shape" enableBackground={}/> */}

      </div>
    </div>
  );
};

export default BoardView;
