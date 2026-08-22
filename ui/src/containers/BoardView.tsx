import React, { useMemo, useRef, useState } from 'react';
import {
  BOARD_RADIUS,
  domainToPresentation,
  validSettlementVertices,
  validRoadEdges,
  playerSettlementVertexIds,
  BoardUIState,
} from 'common';
import { BoardVertex } from '../components/BoardVertex';
import { BoardEdge } from '../components/BoardEdge';
import Hexagon from '../components/Hexagon';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
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

type BuildMode = 'settlement' | 'road' | 'none';

/** Scale limits for responsive board sizing within its panel. */
const BOARD_MIN_SCALE = 0.5;
const BOARD_MAX_SCALE = 1.25;

const buildButtonClass = (active: boolean) =>
  `px-3.5 py-2 border rounded-md cursor-pointer text-sm ${
    active ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'
  }`;

/**
 * Renders the board as an SVG of hexes / edges / vertices.
 *
 * The domain Board's vertex+edge positions are pre-projected by the backend
 * at GAME_HEX_SIZE, so we always convert at that size (PROJ_SIZE) to keep hex
 * and vertex coordinates consistent; the SVG viewBox/width scale the result
 * to the requested render size.
 */
const BoardView: React.FC<BoardViewProps> = ({ hexSize }) => {
  const { gameRoom, currentPlayer, selectedObject, setSelectedObject } = useGameRoom();
  const { buildSettlement, buildRoad, moveSoldier } = useSocket();

  const [buildMode, setBuildMode] = useState<BuildMode>('none');
  const [hoveredVertexId, setHoveredVertexId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Responsive sizing: track the available container size so the board can
  // scale with panel resizes (clamped to BOARD_MIN/MAX_SCALE).
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
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

  // Soldier drag-and-drop state.
  const [drag, setDrag] = useState<{
    soldierId: string;
    ownerName: string;
    fromVertexId: string;
    validTargets: string[];
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const board = gameRoom?.board ?? null;

  // Map owner name -> chosen color so settlements/roads render in the
  // player's color.
  const colorOf = (ownerId: string | null): string | undefined => {
    if (!ownerId || !gameRoom) return undefined;
    return gameRoom.players.find((p) => p.name === ownerId)?.color;
  };

  // Recompute the presentation state + valid placements whenever the board,
  // the acting player, or the build mode changes.
  const base = useMemo<{ state: BoardUIState; validVertexIds: string[]; validEdgeIds: string[] } | null>(() => {
    if (!board) return null;

    const state = domainToPresentation(board, PROJ_SIZE);
    let validVertexIds: string[] = [];
    let validEdgeIds: string[] = [];

    if (buildMode === 'settlement') {
      validVertexIds = validSettlementVertices(board);
    } else if (buildMode === 'road' && currentPlayer) {
      const owned = playerSettlementVertexIds(board, currentPlayer.name);
      validEdgeIds = validRoadEdges(board, owned);
    }

    const validV = new Set(validVertexIds);
    const validE = new Set(validEdgeIds);
    for (const v of Object.values(state.vertices)) {
      v.isSelectable = buildMode === 'none' ? true : validV.has(v.id);
    }
    for (const e of Object.values(state.edges)) {
      e.isSelectable = buildMode === 'none' ? true : validE.has(e.id);
    }

    return { state, validVertexIds, validEdgeIds };
  }, [board, buildMode, currentPlayer]);

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

  // `board` is non-null whenever `base` is (the memo derives from it).
  if (!base || !gameRoom || !board) {
    return <div className="text-center text-gray-500">Loading board...</div>;
  }

  // Layer ephemeral interaction state (hover/select) and owner colors onto
  // the presentation.
  const vertices = Object.values(base.state.vertices).map((v) => ({
    ...v,
    isSelected: v.id === (selectedObject?.type === 'vertex' ? selectedObject.id : null),
    isHovered: v.id === hoveredVertexId,
    ownerColor: colorOf(v.settlementOwnerId),
  }));
  const edges = Object.values(base.state.edges).map((e) => ({
    ...e,
    isSelected: e.id === (selectedObject?.type === 'edge' ? selectedObject.id : null),
    isHovered: e.id === hoveredEdgeId,
    ownerColor: colorOf(e.roadOwnerId),
  }));
  const hexes = Object.values(base.state.hexes);

  const handleVertexClick = (vertexId: string) => {
    if (buildMode === 'settlement' && base.validVertexIds.includes(vertexId) && currentPlayer) {
      buildSettlement(currentPlayer.id, vertexId, gameRoom.id);
      setBuildMode('none');
      setSelectedObject(null);
      return;
    }
    setSelectedObject({ type: 'vertex', id: vertexId });
  };

  const handleEdgeClick = (edgeId: string) => {
    if (buildMode === 'road' && base.validEdgeIds.includes(edgeId) && currentPlayer) {
      buildRoad(currentPlayer.id, edgeId, gameRoom.id);
      setBuildMode('none');
      setSelectedObject(null);
      return;
    }
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

  const boardSpan = (BOARD_RADIUS * 2 + 1) * Math.sqrt(3);
  const viewBoxSize = 1.1 * PROJ_SIZE * boardSpan;
  const naturalSize = 1.1 * hexSize * boardSpan;

  // Scale the board to fit its container, clamped so it never becomes too
  // small or too large relative to its natural size.
  let renderSize = naturalSize;
  if (containerSize && containerSize.w > 0 && containerSize.h > 0) {
    const scale = Math.min(containerSize.w / naturalSize, containerSize.h / naturalSize);
    const clampedScale = Math.max(BOARD_MIN_SCALE, Math.min(scale, BOARD_MAX_SCALE));
    renderSize = naturalSize * clampedScale;
  }

  return (
    <div className="w-full h-full flex flex-col">
      {buildMode !== 'none' && (
        <div className="flex gap-2 mt-3">
          <button
            className={buildButtonClass(buildMode === 'settlement')}
            onClick={() => setBuildMode('settlement')}
          >
            Build Settlement
          </button>
          <button
            className={buildButtonClass(buildMode === 'road')}
            onClick={() => setBuildMode('road')}
          >
            Build Road
          </button>
          <button
            className={buildButtonClass(false)}
            onClick={() => setBuildMode('none')}
          >
            Cancel
          </button>
        </div>
      )}

      <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
      <svg
        ref={svgRef}
        width={renderSize}
        height={renderSize}
        viewBox={`${-viewBoxSize / 2} ${-viewBoxSize / 2} ${viewBoxSize} ${viewBoxSize}`}
        className="block mx-auto"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setDrag(null);
          setMousePos(null);
        }}
      >
        {/* Hex tiles layer */}
        {hexes.map((hex) => (
          <Hexagon key={hex.id} hex={hex} size={PROJ_SIZE} />
        ))}

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
