import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BOARD_RADIUS, domainToPresentation, BoardUIState } from 'common';
import { useGameActions, useGameState, usePlayers, useSelection } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Button from '../components/ui/Button';
import { useOnEffect } from '../effects';
import { SoldierBadges } from '../components/SoldierBadges';
import { BoardSoldiers } from '../components/board/BoardSoldiers';
import { playerColorMap } from '../utils/soldierPlacement';
import { actableSoldierIds, knightSpawnTargets, movableSoldierIds, robberPlacementTargets, robberTargets, sailPaths } from '../board/selectors';
import { mouseToSvgPoint, nearestWithin } from '../utils/boardInteraction';
import { HexLayer } from '../components/board/HexLayer';
import { EdgeLayer, VertexLayer } from '../components/board/PieceLayers';
import { StructureLayer } from '../components/board/StructureLayer';
import BuildAnimationLayer from '../components/board/BuildAnimationLayer';
import { ShipLayer } from '../components/board/ShipLayer';
import { PortLayer } from '../components/board/PortLayer';
import { RobberBagPopup } from '../components/board/RobberBagPopup';
import { DragOverlays } from '../components/board/DragOverlays';
import { SpawnTargetLayer } from '../components/board/SpawnTargetLayer';
import { PointerFinger } from '../components/board/PointerFinger';
import { useSetupCoach } from '../hooks/useSetupCoach';
import { useBoardViewport } from '../hooks/useBoardViewport';
import { useBoardDrag } from '../hooks/useBoardDrag';
import {
  BOARD_MAX_SCALE,
  BOARD_MIN_SCALE,
  BOARD_RENDER_MARGIN,
  BOARD_VIEWBOX_MARGIN,
  PROJ_SIZE,
  ROBBER_Y_OFFSET_FRACTION,
  SAIL_CLICK_DRIFT_PX,
  SAIL_FIT_PADDING,
  SELECT_FOCUS_ZOOM,
} from '../constants';
import { BoardViewProps } from '../types/board';
import {
  countSoldiersByVertexAndOwner,
  groupPortVertices,
  layerBoardInteraction,
} from '../utils/boardPresentation';
import { C } from '../theme';

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
  const { gameRoom, currentPlayer } = useGameState();
  const { selectedObject, selectedSoldierIds, sailingShipId } = useSelection();
  const { setSelectedObject, setSelectedSoldierIds } = useGameActions();
  const { moveSoldier, moveRobber, moveRobberAfterWin, moveShip } = useSocket();

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

  // Shared drag flag: the viewport touch layer suppresses pan/pinch while a
  // piece drag is live (must be declared before useBoardViewport).
  const dragActiveRef = useRef(false);

  // Pan/zoom over the board's coordinate space (viewBox-based).
  const span = (BOARD_RADIUS * 2 + 1) * Math.sqrt(3);
  // The margin leaves room past the hex ring so the trade ports (which sit in
  // the water beyond the board edge) are not clipped by the viewBox.
  const baseSize = BOARD_VIEWBOX_MARGIN * PROJ_SIZE * span;
  // In-game the map fills its container (no letterboxing); the waiting-room
  // preview stays a fixed square.
  const isPlaying = gameRoom?.gameStatus === 'playing';
  const viewport = useBoardViewport(svgRef, baseSize, isPlaying ? containerSize : null, dragActiveRef);

  // Drag state machine: soldier drags between adjacent vertices, the pending
  // robber move, Escape cancellation and drop resolution.
  const {
    drag,
    robberDrag,
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
    dragActiveRef,
  });

  const { focusOn, restoreView, fitView, zoomToFit, forgetView } = viewport;

  // Sail pick-mode: the reachable water vertices (BFS within shipSteps) and
  // their hop paths. A click emits one moveShip per hop along the path.
  const sailTargetPaths = useMemo(() => {
    if (!gameRoom || !currentPlayer || !sailingShipId) return new Map<string, string[]>();
    return sailPaths(gameRoom, currentPlayer.name, sailingShipId);
  }, [gameRoom, currentPlayer, sailingShipId]);
  // The target the path preview snaps to — the reachable vertex nearest the
  // cursor, so the route is drawn while the pointer is merely close.
  const [sailHoverId, setSailHoverId] = useState<string | null>(null);
  const sailHoverPath = sailHoverId ? sailTargetPaths.get(sailHoverId) : undefined;
  // Remember sail mode across the clear so its zoomed-out view isn't
  // unwound by the selection-clear restore below.
  const wasSailingRef = useRef(false);
  // One commit per press: a vertex click and its bubbled svg click both fire.
  const sailCommittedRef = useRef(false);
  // Entering pick mode zooms out to frame the ship with every reachable
  // vertex (once per ship — later room updates don't re-frame).
  const sailFittedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sailingShipId || !board) {
      sailFittedRef.current = null;
      setSailHoverId(null);
      return;
    }
    if (sailFittedRef.current === sailingShipId) return;
    sailFittedRef.current = sailingShipId;
    const ship = board.ships[sailingShipId];
    const points = [...sailTargetPaths.keys()]
      .map((id) => board.vertices[id]?.position)
      .filter((p): p is { x: number; y: number } => !!p);
    if (ship) points.unshift(board.vertices[ship.vertexId]?.position ?? { x: 0, y: 0 });
    zoomToFit(points, SAIL_FIT_PADDING);
     
  }, [sailingShipId, board, sailTargetPaths, zoomToFit]);

  /** Commit the sail to `targetId` (one moveShip per hop) and exit pick-mode. */
  const commitSail = useCallback(
    (targetId: string | null) => {
      if (sailCommittedRef.current || !sailingShipId) return;
      const path = targetId ? sailTargetPaths.get(targetId) : undefined;
      if (!path) return;
      sailCommittedRef.current = true;
      for (const hop of path) moveShip(sailingShipId, hop);
      setSelectedObject(null);
      setTimeout(() => {
        sailCommittedRef.current = false;
      }, 0);
    },
    [sailingShipId, sailTargetPaths, moveShip, setSelectedObject]
  );

  /** The reachable sail target nearest a board-space point, or null. */
  const nearestSailTarget = useCallback(
    (pos: { x: number; y: number } | null): string | null => {
      if (!pos || !base) return null;
      return nearestWithin(
        sailTargetPaths.keys(),
        pos,
        Number.POSITIVE_INFINITY,
        (id) => base.vertices[id]?.position ?? null
      );
    },
    [base, sailTargetPaths]
  );

  // Mouse (and only mouse) reports the pointer; touch taps carry no hover.
  const lastPointerTypeRef = useRef<string>('mouse');
  const boardDownRef = useRef<{ x: number; y: number } | null>(null);
  const handleBoardPointerDown = useCallback((e: React.PointerEvent) => {
    lastPointerTypeRef.current = e.pointerType;
    boardDownRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleBoardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      handlePointerMove(e);
      if (sailingShipId) {
        const id = nearestSailTarget(mouseToSvgPoint(e, svgRef.current));
        if (id !== sailHoverId) setSailHoverId(id);
      }
    },
    [handlePointerMove, sailingShipId, nearestSailTarget, sailHoverId]
  );
  // Any board click commits the previewed sail — except pan-drags (drift)
  // and touch taps away from a ring (they may be abandoned pans).
  const handleBoardClick = useCallback(
    (e: React.MouseEvent) => {
      if (!sailingShipId || lastPointerTypeRef.current === 'touch') return;
      const down = boardDownRef.current;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > SAIL_CLICK_DRIFT_PX) return;
      commitSail(nearestSailTarget(mouseToSvgPoint(e, svgRef.current)));
    },
    [sailingShipId, nearestSailTarget, commitSail]
  );
  const handleBoardContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!sailingShipId) return;
      e.preventDefault();
      setSelectedObject(null);
    },
    [sailingShipId, setSelectedObject]
  );

  // Clearing the selection (the ✕ bubble or Escape) glides back to the view
  // from before the click-to-focus — except after sail pick-mode, which
  // keeps its zoomed-out frame.
  useEffect(() => {
    if (!selectedObject) {
      const wasSailing = wasSailingRef.current;
      wasSailingRef.current = false;
      (wasSailing ? forgetView : restoreView)();
    }
  }, [selectedObject, restoreView, forgetView]);
  useEffect(() => {
    wasSailingRef.current = wasSailingRef.current || !!sailingShipId;
  }, [sailingShipId]);
  // An action asking for the whole board (the robber's Move bubble) glides
  // out to the fit view so every highlighted target hex is on screen.
  useOnEffect('boardFit', fitView);

  // Clicking a vertex or edge selects it and glides the board in, centered on
  // it (an edge centers on its midpoint). During sail pick-mode any mouse
  // click commits the snapped sail (touch ignores taps outside the rings).
  // The waiting-room preview board stays static.
  const handleVertexClick = useCallback(
    (vertexId: string) => {
      if (sailingShipId) {
        if (lastPointerTypeRef.current === 'touch') return;
        commitSail(nearestSailTarget(base?.vertices[vertexId]?.position ?? null));
        return;
      }
      setSelectedObject({ type: 'vertex', id: vertexId });
      const v = base?.vertices[vertexId];
      if (v && isPlaying) focusOn(v.position, SELECT_FOCUS_ZOOM);
    },
    [setSelectedObject, base, isPlaying, focusOn, sailingShipId, nearestSailTarget, commitSail]
  );

  // Clicking a ship selects it (its bubbles offer Sail / Settle / Disembark).
  // During sail pick-mode the click resolves the pending sail instead.
  const handleShipClick = useCallback(
    (shipId: string) => {
      if (sailingShipId) return;
      setSelectedObject({ type: 'ship', id: shipId });
      const ship = board?.ships[shipId];
      const v = ship ? base?.vertices[ship.vertexId] : null;
      if (v && isPlaying) focusOn(v.position, SELECT_FOCUS_ZOOM);
    },
    [setSelectedObject, board, base, isPlaying, focusOn, sailingShipId]
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
  const { colorOf } = usePlayers();

  // Owner -> color as a plain map, for the zoomed-in soldier sprites.
  const playerColors = useMemo(() => playerColorMap(gameRoom), [gameRoom]);

  // Soldier picking on the selected vertex (for the soldier action bubbles):
  // which of my soldiers there can be picked, and which are picked now.
  const selectedVertexId = selectedObject?.type === 'vertex' ? selectedObject.id : null;
  const pickableSoldierIds = useMemo(
    () => new Set(actableSoldierIds(gameRoom, currentPlayer?.name, selectedVertexId)),
    [gameRoom, currentPlayer?.name, selectedVertexId]
  );
  // Energy bolts on every soldier sprite that still has its action (my Action
  // phase only) — no vertex selection needed. Board-wide variant of
  // `actableSoldierIds`, so the selected vertex's pickable soldiers are
  // automatically included.
  const boltedSoldierIds = useMemo(
    () => new Set(actableSoldierIds(gameRoom, currentPlayer?.name)),
    [gameRoom, currentPlayer?.name]
  );
  // Sprites the touch layer may treat as drag handles — the movable gate
  // `isSoldierDraggable` applies (own Action phase, movable this turn: not
  // freshly healed, not a stationed cannon). Anything else pans on touch.
  const draggableSoldierIds = useMemo(
    () => new Set(movableSoldierIds(gameRoom, currentPlayer?.name)),
    [gameRoom, currentPlayer?.name]
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
      base && board
        ? layerBoardInteraction(base, board, selectedObject, hoveredVertexId, hoveredEdgeId, colorOf)
        : null,
    [base, board, selectedObject, hoveredVertexId, hoveredEdgeId, colorOf]
  );

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      if (sailingShipId) {
        if (lastPointerTypeRef.current === 'touch') return;
        const e2 = base?.edges[edgeId];
        commitSail(
          nearestSailTarget(
            e2 ? { x: (e2.start.x + e2.end.x) / 2, y: (e2.start.y + e2.end.y) / 2 } : null
          )
        );
        return;
      }
      setSelectedObject({ type: 'edge', id: edgeId });
      const e = base?.edges[edgeId];
      if (e && isPlaying) {
        focusOn({ x: (e.start.x + e.end.x) / 2, y: (e.start.y + e.end.y) / 2 }, SELECT_FOCUS_ZOOM);
      }
    },
    [setSelectedObject, base, isPlaying, focusOn, sailingShipId, nearestSailTarget, commitSail]
  );

  const onRobberHover = useCallback(
    (hexId: string, hovering: boolean) => setHoveredRobberHexId(hovering ? hexId : null),
    []
  );
  // Clicking the robber selects it: its Attack / Move bubbles open.
  const onRobberClick = useCallback(() => {
    const robberHex = board && Object.values(board.hexes).find((h) => h.robber);
    if (robberHex) setSelectedObject({ type: 'robber', id: robberHex.id });
  }, [board, setSelectedObject]);
  // Clicking a highlighted hex while a robber move is pending places it there.
  const onHexClick = useCallback(
    (hexId: string) => {
      if (winPending) moveRobberAfterWin(hexId);
      else if (robberPending) moveRobber(hexId);
      setSelectedObject(null);
    },
    [winPending, robberPending, moveRobber, moveRobberAfterWin, setSelectedObject]
  );
  // The hexes the robber may land on right now: adjacent non-desert hexes
  // after a won fight, or any non-desert empty hex for a pending 7/knight
  // placement. Highlighted while the move is pending.
  const robberTargetIds = useMemo(() => {
    if (!board) return new Set<string>();
    const from = gameRoom?.robberDefeatedBy?.fromHexId;
    if (winPending && from) return new Set(robberTargets(board, from));
    if (robberPending) return new Set(robberPlacementTargets(board));
    return new Set<string>();
  }, [board, gameRoom?.robberDefeatedBy?.fromHexId, winPending, robberPending]);

  // Knight spawn: while my played Knight waits for its soldier, every vertex
  // where I already have a soldier is a target (same rule as the server's
  // `canKnightSpawnAt`).
  const choice = gameRoom?.devCardChoice;
  const spawnPending =
    choice?.card === 'knight' && !!choice.spawn && choice.player === currentPlayer?.name;
  const spawnTargets = useMemo(() => {
    if (!board || !spawnPending || !currentPlayer) return [];
    return knightSpawnTargets(board, currentPlayer.name).map((id) => ({
      id,
      position: board.vertices[id].position,
    }));
  }, [board, spawnPending, currentPlayer]);

  // Setup coach: a suggested spot for my next settlement/road (null when off).
  const coach = useSetupCoach(board);
  // A new coach step (the previous placement landed): drop the old selection
  // so the view glides back out and the next suggested spot is on screen.
  const coachTarget = coach?.targetId;
  useEffect(() => {
    if (coachTarget) setSelectedObject(null);
  }, [coachTarget, setSelectedObject]);

  // `board` is non-null whenever `base` is (the memo derives from it). This
  // early return must stay below every hook call above.
  if (!base || !gameRoom || !board || !layered) {
    return <div className="text-center text-ink-faint">Loading board...</div>;
  }
  const { vertices, edges, hexes } = layered;
  const robberHex = hexes.find((h) => h.hasRobber);

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
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-ocean"
      >
        {viewport.isDirty && (
          <Button
            size="sm"
            onClick={viewport.reset}
            className="absolute top-2 right-2 z-10"
            title="Reset zoom and position"
          >
            Reset
          </Button>
        )}
        <svg
          ref={svgRef}
          data-board-svg="true"
          width={isPlaying ? '100%' : renderSize}
          height={isPlaying ? '100%' : renderSize}
          viewBox={viewport.viewBox}
          style={{ touchAction: 'none', cursor: sailingShipId ? 'crosshair' : undefined }}
          onDragStart={(e) => e.preventDefault()}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={cancelDrag}
          onPointerLeave={cancelDrag}
          onClick={handleBoardClick}
          onContextMenu={handleBoardContextMenu}
          onMouseDown={viewport.onMouseDown}
          onDoubleClick={viewport.onDoubleClick}
        >
          {/* Hex tiles layer (robber clickable; targets clickable while a
              robber move is pending) */}
          <HexLayer
            hexes={hexes}
            robberPending={robberPending}
            winPending={winPending}
            robberTargetIds={robberTargetIds}
            rollTotal={rollTotal}
            onRobberPointerDown={startRobberDrag}
            onWinRobberPointerDown={startWinDrag}
            onRobberClick={onRobberClick}
            onHexClick={onHexClick}
            onRobberHover={onRobberHover}
          />

          {/* Edges layer */}
          <EdgeLayer edges={edges} onClick={handleEdgeClick} onHover={setHoveredEdgeId} />
          {/* Trade ports (harbors): one icon per dock, with a little road
              to each of the 1-2 vertices it serves. */}
          <PortLayer portGroups={portGroups} />

          {/* Vertices layer: hit areas and dots. */}
          <VertexLayer vertices={vertices} onClick={handleVertexClick} onHover={setHoveredVertexId} />

          {/* Walls, settlements and cities, depth-sorted together so the
              piece standing nearer the viewer draws on top. */}
          <StructureLayer
            vertices={vertices}
            edges={edges}
            onVertexClick={handleVertexClick}
            onVertexHover={setHoveredVertexId}
          />

          {/* Build animations: piece pops/grow/smoke replayed from board
              diffs; cosmetic only, claims the real piece while playing. */}
          <BuildAnimationLayer base={base} colorOf={colorOf} />

          {/* Ships on their water vertices (above the vertex layer so a
              click reaches the ship first). */}
          <ShipLayer
            board={board}
            selectedShipId={selectedObject?.type === 'ship' ? selectedObject.id : null}
            colorOf={colorOf}
            onClick={handleShipClick}
          />

          {/* Sail targets: every water vertex the sailing ship can reach
              within its remaining steps (blue rings, badged with the hop
              count; hovering previews the route). */}
          {sailingShipId && sailTargetPaths.size > 0 && (
            <>
              {sailHoverPath && board.ships[sailingShipId] && (
                <polyline
                  points={[board.ships[sailingShipId].vertexId, ...sailHoverPath]
                    .map((id) => board.vertices[id]?.position)
                    .filter(Boolean)
                    .map((p) => `${p!.x},${p!.y}`)
                    .join(' ')}
                  fill="none"
                  stroke={C['sky.soft']}
                  strokeWidth={4}
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                  opacity={0.8}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              <SpawnTargetLayer
                targets={[...sailTargetPaths].map(([id, path]) => ({
                  id,
                  position: board.vertices[id].position,
                  badge: path.length,
                }))}
                onSelect={(id) => commitSail(id)}
                label="Sail here"
                tone="blue"
              />
            </>
          )}



          {/* Soldiers: count badges below DETAIL_ZOOM_IN; individual soldier
              SVGs at or above that zoom. */}
          {viewport.detailed ? (
            <BoardSoldiers
              board={board}
              playerColors={playerColors}
              onSelect={handleSoldierSelect}
              selectedVertexId={selectedVertexId}
              pickableSoldierIds={pickableSoldierIds}
              boltedSoldierIds={boltedSoldierIds}
              draggableSoldierIds={draggableSoldierIds}
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
            settle={settle}
            onSettleDone={clearSettle}
            vertices={board.vertices}
            colorOf={colorOf}
          />

          {/* Knight spawn targets (pulsing rings), above the soldiers. */}
          {spawnTargets.length > 0 && <SpawnTargetLayer targets={spawnTargets} onSelect={handleVertexClick} />}

          {/* "Move me" hint over the robber while it's my move (hidden mid-drag). */}
          {(robberPending || winPending) && !robberDrag && robberHex && (
            <PointerFinger
              at={{ x: robberHex.position.x, y: robberHex.position.y - PROJ_SIZE * ROBBER_Y_OFFSET_FRACTION }}
            />
          )}

          {/* Setup coach: a clickable ring + finger on a suggested spot, until
              its build bubble is open (the bubble then gets the finger). */}
          {coach && !coach.bubbleOpen && (
            <PointerFinger
              at={coach.at}
              label={coach.caption}
              onTargetClick={() =>
                coach.key === 'settlement' ? handleVertexClick(coach.targetId) : handleEdgeClick(coach.targetId)
              }
            />
          )}

          {/* Robber's bag: dialog popup over the hovered robber (top layer so
              it isn't covered by the hexes). */}
          <RobberBagPopup hex={hexes.find((h) => h.id === hoveredRobberHexId) ?? null} />
        </svg>
      </div>
    </div>
  );
};

export default BoardView;
