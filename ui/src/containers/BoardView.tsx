import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_RADIUS, domainToPresentation, BoardUIState } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { BoardEdge } from '../components/BoardEdge';
import { BoardVertex } from '../components/BoardVertex';
import Hexagon from '../components/Hexagon';
import { useBoardViewport } from '../hooks/useBoardViewport';
import { ownerAngle } from '../utils/soldierPlacement';
import {
  DROP_TARGET_RING_R,
  DROP_THRESHOLD_FRACTION,
  PROJ_SIZE,
  SOLDIER_BADGE_R,
  SOLDIER_BADGE_RADIUS_FRACTION,
} from '../constants';

interface BoardViewProps {
  /** On-screen render size (lobby preview vs. full game). */
  hexSize: number;
}

/** Scale limits for responsive board sizing within its panel. */
const BOARD_MIN_SCALE = 0.5;
const BOARD_MAX_SCALE = 1.25;

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

  // Soldier drag-and-drop state.
  const [drag, setDrag] = useState<{
    soldierId: string;
    ownerName: string;
    fromVertexId: string;
    validTargets: string[];
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
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

  // A pending robber move (a 7 roll or a played knight card) makes valid
  // hexes clickable for the pending player: clicking one places the robber.
  const robberMove = gameRoom?.robberMove ?? null;
  const robberPending = !!robberMove && robberMove.player === currentPlayer?.name;
  const handleHexClick = (hexId: string) => {
    if (!robberPending || !currentPlayer || !gameRoom) return;
    moveRobber(currentPlayer.id, hexId, gameRoom.id);
  };

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

  // Group soldiers by vertex, then by owner (for count badges).
  const soldierGroups = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    if (!board) return map;
    for (const s of Object.values(board.soldiers)) {
      let byOwner = map.get(s.vertexId);
      if (!byOwner) {
        byOwner = new Map();
        map.set(s.vertexId, byOwner);
      }
      byOwner.set(s.owner, (byOwner.get(s.owner) ?? 0) + 1);
    }
    return map;
  }, [board]);

  // First soldier id per (vertex, owner) pair — used as the drag handle.
  const soldierDragId = useMemo(() => {
    const map = new Map<string, string>();
    if (!board) return map;
    for (const s of Object.values(board.soldiers)) {
      const key = `${s.vertexId}|${s.owner}`;
      if (!map.has(key)) map.set(key, s.id);
    }
    return map;
  }, [board]);

  // Pan/zoom over the board's coordinate space (viewBox-based).
  const boardSpan = (BOARD_RADIUS * 2 + 1) * Math.sqrt(3);
  const baseSize = 1.1 * PROJ_SIZE * boardSpan;
  const viewport = useBoardViewport(svgRef, baseSize);

  // Escape clears the selection and cancels any in-progress soldier drag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDrag(null);
      setMousePos(null);
      setSelectedObject(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSelectedObject]);

  // `board` is non-null whenever `base` is (the memo derives from it).
  if (!base || !gameRoom || !board) {
    return <div className="text-center text-gray-500">Loading board...</div>;
  }

  // Map owner name -> chosen color so settlements/roads render in the
  // player's color.
  const colorOf = (ownerId: string | null): string | undefined => {
    if (!ownerId || !gameRoom) return undefined;
    return gameRoom.players.find((p) => p.name === ownerId)?.color;
  };

  // Layer ephemeral interaction state (hover/select) and owner colors onto
  // the presentation.
  const vertices = Object.values(base.vertices).map((v) => ({
    ...v,
    isSelected: v.id === (selectedObject?.type === 'vertex' ? selectedObject.id : null),
    isHovered: v.id === hoveredVertexId,
    ownerColor: colorOf(v.settlementOwnerId),
  }));
  const edges = Object.values(base.edges).map((e) => ({
    ...e,
    isSelected: e.id === (selectedObject?.type === 'edge' ? selectedObject.id : null),
    isHovered: e.id === hoveredEdgeId,
    ownerColor: colorOf(e.roadOwnerId),
  }));
  const hexes = Object.values(base.hexes);

  const handleVertexClick = (vertexId: string) => {
    setSelectedObject({ type: 'vertex', id: vertexId });
  };

  const handleEdgeClick = (edgeId: string) => {
    setSelectedObject({ type: 'edge', id: edgeId });
  };

  const canDragSoldier = (ownerName: string): boolean =>
    gameRoom.turnState.phase === 'Action' && currentPlayer?.name === ownerName;

  const startDrag = (e: React.MouseEvent, soldierId: string, ownerName: string, vertexId: string) => {
    if (!canDragSoldier(ownerName) || !board) return;
    e.stopPropagation();
    const validTargets: string[] = [];
    const v = board.vertices[vertexId];
    if (v) {
      for (const edgeId of v.roadIds) {
        const edge = board.edges[edgeId];
        if (!edge || edge.roadId === null) continue; // no road on this edge
        const other = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
        validTargets.push(other);
      }
    }
    setDrag({ soldierId, ownerName, fromVertexId: vertexId, validTargets });
  };

  const toSvgCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setMousePos(toSvgCoords(e));
  };

  const handleMouseUp = () => {
    if (!drag || !mousePos || !board || !currentPlayer) {
      setDrag(null);
      setMousePos(null);
      return;
    }
    // Drop on the nearest valid target vertex within reach.
    let best: string | null = null;
    let bestDist = Infinity;
    for (const tid of drag.validTargets) {
      const v = board.vertices[tid];
      if (!v) continue;
      const d = Math.hypot(v.position.x - mousePos.x, v.position.y - mousePos.y);
      if (d < bestDist) {
        bestDist = d;
        best = tid;
      }
    }
    const threshold = PROJ_SIZE * DROP_THRESHOLD_FRACTION;
    if (best && bestDist <= threshold) {
      moveSoldier(currentPlayer.id, drag.soldierId, best, gameRoom.id);
    }
    setDrag(null);
    setMousePos(null);
  };

  const naturalSize = 1.1 * hexSize * boardSpan;

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
      <div ref={containerRef} className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
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
          width={renderSize}
          height={renderSize}
          viewBox={viewport.viewBox}
          className="block mx-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setDrag(null);
            setMousePos(null);
          }}
          onMouseDown={viewport.onMouseDown}
          onWheel={viewport.onWheel}
          onDoubleClick={viewport.onDoubleClick}
        >
          {/* Hex tiles layer (clickable while a robber move is pending) */}
          {hexes.map((hex) => {
            const isRobberTarget = robberPending && hex.terrain !== 'Desert' && !hex.hasRobber;
            return (
              <Hexagon
                key={hex.id}
                hex={hex}
                size={PROJ_SIZE}
                onClick={isRobberTarget ? handleHexClick : undefined}
                highlight={isRobberTarget}
              />
            );
          })}

          {/* Edges layer */}
          {edges.map((edge) => (
            <BoardEdge
              key={edge.id}
              {...edge}
              onClick={handleEdgeClick}
              onHover={setHoveredEdgeId}
            />
          ))}

          {/* Vertices layer */}
          {vertices.map((vertex) => (
            <BoardVertex
              key={vertex.id}
              {...vertex}
              size={8}
              onClick={handleVertexClick}
              onHover={setHoveredVertexId}
            />
          ))}

          {/* Soldiers layer: count badges around each vertex */}
          {Array.from(soldierGroups.entries()).map(([vertexId, byOwner]) => {
            const v = board.vertices[vertexId];
            if (!v) return null;
            const entries = Array.from(byOwner.entries());
            return (entries as [string, number][]).map(([ownerName, count], i) => {
              const angle = ownerAngle(i, entries.length);
              const radius = PROJ_SIZE * SOLDIER_BADGE_RADIUS_FRACTION;
              const cx = v.position.x + Math.cos(angle) * radius;
              const cy = v.position.y + Math.sin(angle) * radius;
              const color = colorOf(ownerName);
              const draggable = canDragSoldier(ownerName);
              const dragId = soldierDragId.get(`${vertexId}|${ownerName}`);
              return (
                <g
                  key={`${vertexId}-${ownerName}`}
                  onMouseDown={(e) => {
                    if (dragId) startDrag(e, dragId, ownerName, vertexId);
                  }}
                  onClick={() => setSelectedObject({ type: 'vertex', id: vertexId })}
                  style={{ cursor: draggable ? 'grab' : 'pointer' }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={SOLDIER_BADGE_R}
                    fill={color ?? '#888'}
                    stroke="#222"
                    strokeWidth={1.5}
                  />
                  <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="bold"
                    fill="white"
                    pointerEvents="none"
                  >
                    {count}
                  </text>
                </g>
              );
            });
          })}

          {/* Drag feedback: highlight valid drop targets */}
          {drag &&
            drag.validTargets.map((tid) => {
              const v = board.vertices[tid];
              if (!v) return null;
              return (
                <circle
                  key={tid}
                  cx={v.position.x}
                  cy={v.position.y}
                  r={DROP_TARGET_RING_R}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={3}
                  strokeDasharray="4,3"
                />
              );
            })}

          {/* Drag ghost following the cursor */}
          {drag && mousePos && (
            <circle
              cx={mousePos.x}
              cy={mousePos.y}
              r={SOLDIER_BADGE_R}
              fill={colorOf(drag.ownerName) ?? '#888'}
              opacity={0.6}
              stroke="#222"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          )}
        </svg>
      </div>
    </div>
  );
};

export default BoardView;
