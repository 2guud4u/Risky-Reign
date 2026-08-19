import React, { useMemo, useState } from 'react';
import {
  GAME_HEX_SIZE,
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

interface BoardViewProps {
  /** On-screen render size (lobby preview vs. full game). */
  hexSize: number;
}

/** Standard Catan board radius (19 hexes). */
const BOARD_RADIUS = 2;
/** Internal projection size — must match the backend's board projection. */
const PROJ_SIZE = GAME_HEX_SIZE;

type BuildMode = 'settlement' | 'road' | 'none';

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
  const { buildSettlement, buildRoad } = useSocket();

  const [buildMode, setBuildMode] = useState<BuildMode>('none');
  const [hoveredVertexId, setHoveredVertexId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const board = gameRoom?.board ?? null;

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

  if (!base || !gameRoom) {
    return <div className="text-center text-gray-500">Loading board...</div>;
  }

  // Layer ephemeral interaction state (hover/select) onto the presentation.
  const vertices = Object.values(base.state.vertices).map((v) => ({
    ...v,
    isSelected: v.id === (selectedObject?.type === 'vertex' ? selectedObject.id : null),
    isHovered: v.id === hoveredVertexId,
  }));
  const edges = Object.values(base.state.edges).map((e) => ({
    ...e,
    isSelected: e.id === (selectedObject?.type === 'edge' ? selectedObject.id : null),
    isHovered: e.id === hoveredEdgeId,
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

  const boardSpan = (BOARD_RADIUS * 2 + 1) * Math.sqrt(3);
  const viewBoxSize = 1.1 * PROJ_SIZE * boardSpan;
  const renderSize = 1.1 * hexSize * boardSpan;

  return (
    <div>
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

      <svg
        width={renderSize}
        height={renderSize}
        viewBox={`${-viewBoxSize / 2} ${-viewBoxSize / 2} ${viewBoxSize} ${viewBoxSize}`}
        className="block mx-auto"
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
      </svg>
    </div>
  );
};

export default BoardView;
