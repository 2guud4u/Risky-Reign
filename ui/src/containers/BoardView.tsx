import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BOARD_RADIUS, domainToPresentation, BoardUIState, adjacentHexIds } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { SoldierBadges } from '../components/SoldierBadges';
import { BoardSoldiers } from '../components/board/BoardSoldiers';
import { playerColorMap } from '../utils/soldierPlacement';
import { actableSoldierIds } from '../utils/soldierActions';
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
  SELECT_FOCUS_ZOOM,
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
 * it (its build actions then appear as bubbles on the map). It also supports
 * dragging your own soldiers between adjacent vertices during the Action
 * phase, panning (drag empty space) and zooming (wheel / double-click).
 * Escape clears the selection and cancels any in-progress drag.
 */
const BoardView: React.FC<BoardViewProps> = ({ hexSize }) => {
  const { gameRoom, currentPlayer, selectedObject, setSelectedObject, selectedSoldierIds, setSelectedSoldierIds } =
    useGameRoom();
  const { moveSoldier, moveRobber, moveRobberAfterWin } = useSocket();

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
  // fully selectable — build actions are gated in the on-map bubbles, so
  // nothing is gated here.
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
  // In-game the map fills its container (no letterboxing); the waiting-room
  // preview stays a fixed square.
  const isPlaying = gameRoom?.gameStatus === 'playing';
  const viewport = useBoardViewport(svgRef, baseSize, isPlaying ? containerSize : null);

  // Drag state machine: soldier drags between adjacent vertices, the pending
  // robber move, Escape cancellation and drop resolution.
  const {
    drag,
    robberDrag,
    mousePos,
    robberPending,
    winPending,
    canDragSoldier,
    startDrag,
    startDragSoldier,
    startRobberDrag,
    startWinDrag,
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
    moveRobberAfterWin,
  });

  const { focusOn, restoreView } = viewport;
  // Clearing the selection (the ✕ bubble or Escape) glides back to the view
  // from before the click-to-focus.
  useEffect(() => {
    if (!selectedObject) restoreView();
  }, [selectedObject, restoreView]);
  // Clicking a vertex or edge selects it and glides the board in, centered on
  // it (an edge centers on its midpoint). The waiting-room preview board stays
  // static (the game hasn't started).
  const handleVertexClick = useCallback(
    (vertexId: string) => {
      setSelectedObject({ type: 'vertex', id: vertexId });
      const v = base?.vertices[vertexId];
      if (v && isPlaying) focusOn(v.position, SELECT_FOCUS_ZOOM);
    },
    [setSelectedObject, base, isPlaying, focusOn]
  );

  // Clicking a soldier badge or sprite behaves like clicking its vertex
  // (select + glide in), so the zoomed-in soldiers come into view.
  const handleSoldierSelect = useCallback(
    (obj: { type: 'vertex'; id: string }) => handleVertexClick(obj.id),
    [handleVertexClick]
  );

  // Map owner name -> chosen color so settlements/roads render in the
  // player's color. Memoized so the layer components (React.memo) get a
  // stable function reference and don't re-render on pan/zoom. Null-safe so it
  // can run before the early return below.
  const colorOf = useCallback(
    (ownerId: string | null): string | undefined =>
      !ownerId ? undefined : gameRoom?.players.find((p) => p.name === ownerId)?.color,
    [gameRoom?.players]
  );

  // Owner -> color as a plain map, for the zoomed-in soldier sprites.
  const playerColors = useMemo(() => playerColorMap(gameRoom), [gameRoom]);

  // Soldier picking on the selected vertex (for the soldier action bubbles):
  // which of my soldiers there can be picked, and which are picked now.
  const selectedVertexId = selectedObject?.type === 'vertex' ? selectedObject.id : null;
  const pickableSoldierIds = useMemo(
    () => new Set(actableSoldierIds(gameRoom, currentPlayer?.name, selectedVertexId)),
    [gameRoom, currentPlayer?.name, selectedVertexId]
  );
  const pickedSoldierIds = useMemo(() => new Set(selectedSoldierIds), [selectedSoldierIds]);
  const togglePickedSoldier = useCallback(
    (soldierId: string) =>
      setSelectedSoldierIds((prev) =>
        prev.includes(soldierId) ? prev.filter((id) => id !== soldierId) : [...prev, soldierId]
      ),
    [setSelectedSoldierIds]
  );

  // Layer ephemeral interaction state (hover/select) and owner colors onto
  // the presentation. Memoized: without it every render produced fresh
  // hex/edge/vertex arrays, defeating the memoized layer components.
  const layered = useMemo(
    () =>
      base
        ? layerBoardInteraction(base, selectedObject, hoveredVertexId, hoveredEdgeId, colorOf)
        : null,
    [base, selectedObject, hoveredVertexId, hoveredEdgeId, colorOf]
  );

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      setSelectedObject({ type: 'edge', id: edgeId });
      const e = base?.edges[edgeId];
      if (e && isPlaying) {
        focusOn({ x: (e.start.x + e.end.x) / 2, y: (e.start.y + e.end.y) / 2 }, SELECT_FOCUS_ZOOM);
      }
    },
    [setSelectedObject, base, isPlaying, focusOn]
  );

  const onRobberHover = useCallback(
    (hexId: string, hovering: boolean) => setHoveredRobberHexId(hovering ? hexId : null),
    []
  );
  // The hexes the post-win robber may be moved to (adjacent to its current
  // hex, non-desert) — highlighted while the winner must make the move.
  const winTargetIds = useMemo(() => {
    const from = gameRoom?.robberDefeatedBy?.fromHexId;
    if (!board || !from || !winPending) return new Set<string>();
    return new Set(
      adjacentHexIds(board, from).filter((id) => board.hexes[id]?.terrain !== 'Desert')
    );
  }, [board, gameRoom?.robberDefeatedBy?.fromHexId, winPending]);

  // `board` is non-null whenever `base` is (the memo derives from it). This
  // early return must stay below every hook call above.
  if (!base || !gameRoom || !board || !layered) {
    return <div className="text-center text-gray-500">Loading board...</div>;
  }
  const { vertices, edges, hexes } = layered;

  // Waiting-room preview: a fixed-size square board (as before).
  // In-game: the svg fills its whole container and the view extends on the
  // longer side (see useBoardViewport), so the map is never letterboxed or
  // clipped top/bottom, and overlays sit directly on top of it.
  const naturalSize = BOARD_RENDER_MARGIN * hexSize * span;
  let renderSize = naturalSize;
  if (!isPlaying && containerSize && containerSize.w > 0 && containerSize.h > 0) {
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
            Reset
          </button>
        )}
        <svg
          ref={svgRef}
          data-board-svg="true"
          width={isPlaying ? '100%' : renderSize}
          height={isPlaying ? '100%' : renderSize}
          viewBox={viewport.viewBox}
          style={{ touchAction: 'none' }}
          onDragStart={(e) => e.preventDefault()}
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
            winPending={winPending}
            winTargetIds={winTargetIds}
            rollTotal={rollTotal}
            onRobberMouseDown={startRobberDrag}
            onWinRobberMouseDown={startWinDrag}
            onRobberHover={onRobberHover}
          />

          {/* Edges layer */}
          <EdgeLayer edges={edges} onClick={handleEdgeClick} onHover={setHoveredEdgeId} />
          {/* Trade ports (harbors): one icon per dock, with a little road
              to each of the 1-2 vertices it serves. */}
          <PortLayer portGroups={portGroups} />

          {/* Vertices layer */}
          <VertexLayer vertices={vertices} onClick={handleVertexClick} onHover={setHoveredVertexId} />



          {/* Soldiers: count badges below DETAIL_ZOOM_IN; individual soldier
              SVGs at or above that zoom. */}
          {viewport.detailed ? (
            <BoardSoldiers
              board={board}
              playerColors={playerColors}
              onSelect={handleSoldierSelect}
              selectedVertexId={selectedVertexId}
              pickableSoldierIds={pickableSoldierIds}
              pickedSoldierIds={pickedSoldierIds}
              onSoldierClick={togglePickedSoldier}
              onSoldierDragStart={startDragSoldier}
            />
          ) : (
            <SoldierBadges
              soldierGroups={soldierGroups}
              vertices={board.vertices}
              colorOf={colorOf}
              canDragSoldier={canDragSoldier}
              onDragStart={startDrag}
              onSelect={handleSoldierSelect}
            />
          )}

          {/* Drag feedback: drop-target rings and the cursor-following ghost */}
          <DragOverlays
            drag={drag}
            robberDrag={robberDrag}
            mousePos={mousePos}
            vertices={board.vertices}
            colorOf={colorOf}
          />
          {/* Robber's bag: dialog popup over the hovered robber (top layer so
              it isn't covered by the hexes). */}
          <RobberBagPopup hex={hexes.find((h) => h.id === hoveredRobberHexId) ?? null} />
        </svg>
        {/* <image  href="/art/settlement.svg#settlement-shape" enableBackground={}/> */}

      </div>
    </div>
  );
};

export default BoardView;
