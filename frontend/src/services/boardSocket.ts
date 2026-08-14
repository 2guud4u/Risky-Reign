import { BoardUIState } from 'common/types/BoardUI';
import { useBoard } from '../contexts/BoardContext';

/**
 * Socket integration for board interactions
 * Handles vertex clicks for settlement building and edge selection for road building
 */

export interface BoardSocketHandlers {
  onSettlementBuilt: (vertexId: string, playerId: string) => void;
  onRoadBuilt: (edgeId: string, playerId: string) => void;
  onBoardUpdate: (board: BoardUIState) => void;
}

export function useBoardSocketHandlers(socket: any, handlers: BoardSocketHandlers) {
  const { state, updateBoard, updateVertex, updateEdge } = useBoard();

  const handleVertexClick = (vertexId: string) => {
    // Check if vertex is selectable
    const vertex = state.vertices[vertexId];
    if (!vertex?.isSelectable) return;

    // In settlement build mode, emit build request
    if (state.buildMode === 'settlement') {
      socket.emit('buildSettlement', {
        vertexId,
        playerId: socket.playerId,
      });
    }
  };

  const handleEdgeClick = (edgeId: string) => {
    // Check if edge is selectable
    const edge = state.edges[edgeId];
    if (!edge?.isSelectable) return;

    // In road build mode, emit build request
    if (state.buildMode === 'road') {
      socket.emit('buildRoad', {
        edgeId,
        playerId: socket.playerId,
      });
    }
  };

  // Listen for settlement built events
  socket.on('settlementBuilt', (data: { vertexId: string; playerId: string; settlementId: string }) => {
    updateVertex(data.vertexId, {
      hasSettlement: true,
      settlementLevel: 'settlement',
      settlementOwnerId: data.playerId,
    });
    handlers.onSettlementBuilt(data.vertexId, data.playerId);
  });

  // Listen for road built events
  socket.on('roadBuilt', (data: { edgeId: string; playerId: string; roadId: string }) => {
    updateEdge(data.edgeId, {
      hasRoad: true,
      roadOwnerId: data.playerId,
    });
    handlers.onRoadBuilt(data.edgeId, data.playerId);
  });

  // Listen for board updates
  socket.on('boardUpdated', (board: BoardUIState) => {
    updateBoard(board);
    handlers.onBoardUpdate(board);
  });

  // Listen for build mode changes
  socket.on('buildModeChanged', (mode: BoardUIState['buildMode']) => {
    // Update selectability based on mode
    // This would compute which vertices/edges are valid for building
    // For now, just update the mode
  });

  return {
    handleVertexClick,
    handleEdgeClick,
  };
}
