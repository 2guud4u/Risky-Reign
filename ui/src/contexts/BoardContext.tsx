import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { BoardUIState, BoardVertex, BoardEdge } from 'common/v2';

type BoardAction =
  | { type: 'SELECT_VERTEX'; vertexId: string | null }
  | { type: 'SELECT_EDGE'; edgeId: string | null }
  | { type: 'HOVER_VERTEX'; vertexId: string | null }
  | { type: 'HOVER_EDGE'; edgeId: string | null }
  | { type: 'SET_BUILD_MODE'; mode: 'settlement' | 'road' | 'none' }
  | { type: 'UPDATE_BOARD'; board: BoardUIState }
  | { type: 'UPDATE_VERTEX'; vertexId: string; updates: Partial<BoardVertex> }
  | { type: 'UPDATE_EDGE'; edgeId: string; updates: Partial<BoardEdge> };

function boardReducer(state: BoardUIState, action: BoardAction): BoardUIState {
  switch (action.type) {
    case 'SELECT_VERTEX': {
      const newVertices: Record<string, BoardVertex> = { ...state.vertices };
      Object.keys(newVertices).forEach((id) => {
        newVertices[id] = { ...newVertices[id], isSelected: false };
      });
      if (action.vertexId && newVertices[action.vertexId]) {
        newVertices[action.vertexId] = { ...newVertices[action.vertexId], isSelected: true };
      }
      return { ...state, vertices: newVertices, selectedVertexId: action.vertexId };
    }

    case 'SELECT_EDGE': {
      const newEdges: Record<string, BoardEdge> = { ...state.edges };
      Object.keys(newEdges).forEach((id) => {
        newEdges[id] = { ...newEdges[id], isSelected: false };
      });
      if (action.edgeId && newEdges[action.edgeId]) {
        newEdges[action.edgeId] = { ...newEdges[action.edgeId], isSelected: true };
      }
      return { ...state, edges: newEdges, selectedEdgeId: action.edgeId };
    }

    case 'HOVER_VERTEX': {
      const hoverVertices: Record<string, BoardVertex> = { ...state.vertices };
      Object.keys(hoverVertices).forEach((id) => {
        hoverVertices[id] = { ...hoverVertices[id], isHovered: false };
      });
      if (action.vertexId && hoverVertices[action.vertexId]) {
        hoverVertices[action.vertexId] = { ...hoverVertices[action.vertexId], isHovered: true };
      }
      return { ...state, vertices: hoverVertices, hoveredVertexId: action.vertexId };
    }

    case 'HOVER_EDGE': {
      const hoverEdges: Record<string, BoardEdge> = { ...state.edges };
      Object.keys(hoverEdges).forEach((id) => {
        hoverEdges[id] = { ...hoverEdges[id], isHovered: false };
      });
      if (action.edgeId && hoverEdges[action.edgeId]) {
        hoverEdges[action.edgeId] = { ...hoverEdges[action.edgeId], isHovered: true };
      }
      return { ...state, edges: hoverEdges, hoveredEdgeId: action.edgeId };
    }

    case 'SET_BUILD_MODE':
      return { ...state, buildMode: action.mode };

    case 'UPDATE_BOARD':
      return action.board;

    case 'UPDATE_VERTEX':
      return {
        ...state,
        vertices: {
          ...state.vertices,
          [action.vertexId]: { ...state.vertices[action.vertexId], ...action.updates },
        },
      };

    case 'UPDATE_EDGE':
      return {
        ...state,
        edges: {
          ...state.edges,
          [action.edgeId]: { ...state.edges[action.edgeId], ...action.updates },
        },
      };

    default:
      return state;
  }
}

interface BoardContextValue {
  state: BoardUIState;
  selectVertex: (vertexId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  hoverVertex: (vertexId: string | null) => void;
  hoverEdge: (edgeId: string | null) => void;
  setBuildMode: (mode: BoardUIState['buildMode']) => void;
  updateBoard: (board: BoardUIState) => void;
  updateVertex: (vertexId: string, updates: Partial<BoardVertex>) => void;
  updateEdge: (edgeId: string, updates: Partial<BoardEdge>) => void;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export const BoardProvider: React.FC<{ initialState: BoardUIState; children: React.ReactNode }> = ({
  initialState,
  children,
}) => {
  const [state, dispatch] = useReducer(boardReducer, initialState);

  const selectVertex = useCallback((vertexId: string | null) => {
    dispatch({ type: 'SELECT_VERTEX', vertexId });
  }, []);

  const selectEdge = useCallback((edgeId: string | null) => {
    dispatch({ type: 'SELECT_EDGE', edgeId });
  }, []);

  const hoverVertex = useCallback((vertexId: string | null) => {
    dispatch({ type: 'HOVER_VERTEX', vertexId });
  }, []);

  const hoverEdge = useCallback((edgeId: string | null) => {
    dispatch({ type: 'HOVER_EDGE', edgeId });
  }, []);

  const setBuildMode = useCallback((mode: BoardUIState['buildMode']) => {
    dispatch({ type: 'SET_BUILD_MODE', mode });
  }, []);

  const updateBoard = useCallback((board: BoardUIState) => {
    dispatch({ type: 'UPDATE_BOARD', board });
  }, []);

  const updateVertex = useCallback((vertexId: string, updates: Partial<BoardVertex>) => {
    dispatch({ type: 'UPDATE_VERTEX', vertexId, updates });
  }, []);

  const updateEdge = useCallback((edgeId: string, updates: Partial<BoardEdge>) => {
    dispatch({ type: 'UPDATE_EDGE', edgeId, updates });
  }, []);

  return (
    <BoardContext.Provider
      value={{
        state,
        selectVertex,
        selectEdge,
        hoverVertex,
        hoverEdge,
        setBuildMode,
        updateBoard,
        updateVertex,
        updateEdge,
      }}
    >
      {children}
    </BoardContext.Provider>
  );
};

export const useBoard = () => {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error('useBoard must be used within BoardProvider');
  }
  return context;
};
