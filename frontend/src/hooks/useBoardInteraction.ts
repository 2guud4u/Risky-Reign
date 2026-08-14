import { useState, useCallback } from 'react';
import { BoardUIState, BoardVertex, BoardEdge } from 'common/types/BoardUI';

/**
 * Single hook for board interaction - combines selection and build mode
 * Selection behavior changes based on build mode
 */
export function useBoardInteraction(initialState: BoardUIState) {
  const [state, setState] = useState<BoardUIState>(initialState);

  const selectVertex = useCallback((vertexId: string | null) => {
    setState(prev => {
      const newVertices: Record<string, BoardVertex> = { ...prev.vertices };
      
      // Clear previous selection
      Object.keys(newVertices).forEach(id => {
        newVertices[id] = { ...newVertices[id], isSelected: false };
      });
      
      // Set new selection if valid
      if (vertexId && prev.vertices[vertexId]?.isSelectable) {
        newVertices[vertexId] = { ...newVertices[vertexId], isSelected: true };
      }
      
      return {
        ...prev,
        vertices: newVertices,
        selectedVertexId: vertexId,
      };
    });
  }, []);

  const selectEdge = useCallback((edgeId: string | null) => {
    setState(prev => {
      const newEdges: Record<string, BoardEdge> = { ...prev.edges };
      
      // Clear previous selection
      Object.keys(newEdges).forEach(id => {
        newEdges[id] = { ...newEdges[id], isSelected: false };
      });
      
      // Set new selection if valid
      if (edgeId && prev.edges[edgeId]?.isSelectable) {
        newEdges[edgeId] = { ...newEdges[edgeId], isSelected: true };
      }
      
      return {
        ...prev,
        edges: newEdges,
        selectedEdgeId: edgeId,
      };
    });
  }, []);

  const hoverVertex = useCallback((vertexId: string | null) => {
    setState(prev => {
      const newVertices: Record<string, BoardVertex> = { ...prev.vertices };
      
      // Clear previous hover
      Object.keys(newVertices).forEach(id => {
        newVertices[id] = { ...newVertices[id], isHovered: false };
      });
      
      // Set new hover
      if (vertexId && prev.vertices[vertexId]) {
        newVertices[vertexId] = { ...newVertices[vertexId], isHovered: true };
      }
      
      return {
        ...prev,
        vertices: newVertices,
        hoveredVertexId: vertexId,
      };
    });
  }, []);

  const hoverEdge = useCallback((edgeId: string | null) => {
    setState(prev => {
      const newEdges: Record<string, BoardEdge> = { ...prev.edges };
      
      // Clear previous hover
      Object.keys(newEdges).forEach(id => {
        newEdges[id] = { ...newEdges[id], isHovered: false };
      });
      
      // Set new hover
      if (edgeId && prev.edges[edgeId]) {
        newEdges[edgeId] = { ...newEdges[edgeId], isHovered: true };
      }
      
      return {
        ...prev,
        edges: newEdges,
        hoveredEdgeId: edgeId,
      };
    });
  }, []);

  const setBuildMode = useCallback((mode: BoardUIState['buildMode']) => {
    setState(prev => ({
      ...prev,
      buildMode: mode,
    }));
  }, []);

  const updateVertexSelectability = useCallback((vertexIds: string[], selectable: boolean) => {
    setState(prev => {
      const newVertices: Record<string, BoardVertex> = { ...prev.vertices };
      vertexIds.forEach(id => {
        if (newVertices[id]) {
          newVertices[id] = { ...newVertices[id], isSelectable: selectable };
        }
      });
      return { ...prev, vertices: newVertices };
    });
  }, []);

  const updateEdgeSelectability = useCallback((edgeIds: string[], selectable: boolean) => {
    setState(prev => {
      const newEdges: Record<string, BoardEdge> = { ...prev.edges };
      edgeIds.forEach(id => {
        if (newEdges[id]) {
          newEdges[id] = { ...newEdges[id], isSelectable: selectable };
        }
      });
      return { ...prev, edges: newEdges };
    });
  }, []);

  const handleVertexClick = useCallback((vertexId: string) => {
    const vertex = state.vertices[vertexId];
    if (!vertex?.isSelectable) return;
    
    if (state.buildMode === 'settlement') {
      // Build settlement logic
      selectVertex(vertexId);
    } else if (state.buildMode === 'none') {
      // Inspect vertex
      selectVertex(vertexId);
    }
  }, [state.vertices, state.buildMode, selectVertex]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    const edge = state.edges[edgeId];
    if (!edge?.isSelectable) return;
    
    if (state.buildMode === 'road') {
      // Build road logic
      selectEdge(edgeId);
    } else if (state.buildMode === 'none') {
      // Inspect edge
      selectEdge(edgeId);
    }
  }, [state.edges, state.buildMode, selectEdge]);

  return {
    state,
    selectVertex,
    selectEdge,
    hoverVertex,
    hoverEdge,
    setBuildMode,
    updateVertexSelectability,
    updateEdgeSelectability,
    handleVertexClick,
    handleEdgeClick,
  };
}
