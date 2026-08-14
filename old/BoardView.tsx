import React, { useState, useMemo, useEffect } from 'react';
import {
  GameRoom,
  Player,
  BoardVertex as BoardVertexType,
  BoardEdge as BoardEdgeType,
  BoardUIState,
  VertexId,
  EdgeId,
  intersectNodeToBoardVertex,
  createBoardEdges,
  mapRoadsToEdges
} from 'common';
import { BoardVertex } from '../components/BoardVertex';
import { BoardEdge } from '../components/BoardEdge';
import Hexagon from '../components/Hexagon';
import Settlement from '../components/Settlement';
import { useSocket } from '../contexts/SocketContext';
import { useGameRoom } from '../contexts/GameContext';

interface BoardViewProps {
  hexSize: number;
}

const BoardView: React.FC<BoardViewProps> = ({ hexSize }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { buildSettlement, buildRoad } = useSocket();
  
  // UI State
  const [uiState, setUiState] = useState<BoardUIState>({
    selectedVertex: null,
    selectedEdge: null,
    hoveredVertex: null,
    hoveredEdge: null,
    buildMode: null,
    roadStartVertex: null,
    validVertices: new Set(),
    validEdges: new Set(),
  });

  // Convert game data to UI model
  const { vertices, edges } = useMemo(() => {
    if (!gameRoom?.board) return { vertices: [], edges: [] };

    const { Hexes, Vertexs, Settlements, Roads } = gameRoom.board;
    const settlementMap = new Map(
      Settlements.map(s => [s.id, s])
    );

    // Convert vertices to vertices
    const vertices: BoardVertexType[] = Vertexs.map(intersect =>
      intersectNodeToBoardVertex(intersect, settlementMap)
    );

    // Create edges from vertex adjacencies
    let edges = createBoardEdges(vertices);
    
    // Map roads to edges
    edges = mapRoadsToEdges(edges, Roads);

    return { vertices, edges };
  }, [gameRoom]);

  // Calculate valid placements
  useEffect(() => {
    if (!uiState.buildMode || !currentPlayer || !gameRoom?.board) return;

    const validVertices = new Set<VertexId>();
    const validEdges = new Set<EdgeId>();

    if (uiState.buildMode === 'settlement') {
      // Find valid settlement locations
      vertices.forEach(vertex => {
        const hasSettlement = vertex.settlement !== null;
        if (hasSettlement) return;

        // Check distance rule: no adjacent settlements
        const hasAdjacentSettlement = Array.from(vertex.adjacentVertices).some(adjId => {
          const adjVertex = vertices.find(v => v.id === adjId);
          return adjVertex?.settlement !== null;
        });

        if (!hasAdjacentSettlement) {
          validVertices.add(vertex.id);
        }
      });
    } else if (uiState.buildMode === 'road') {
      if (uiState.roadStartVertex !== null) {
        // Find valid edges from start vertex
        edges.forEach(edge => {
          const connectsToStart = 
            edge.vertexA === uiState.roadStartVertex || 
            edge.vertexB === uiState.roadStartVertex;
          
          if (connectsToStart && !edge.road) {
            validEdges.add(edge.id);
          }
        });
      }
    }

    setUiState(prev => ({
      ...prev,
      validVertices,
      validEdges,
    }));
  }, [uiState.buildMode, uiState.roadStartVertex, vertices, edges, currentPlayer, gameRoom]);

  // Handlers
  const handleVertexClick = (vertexId: VertexId) => {
    if (!uiState.buildMode || !currentPlayer) return;

    if (uiState.buildMode === 'settlement') {
      const vertex = vertices.find(v => v.id === vertexId);
      if (!vertex || vertex.settlement) return;

      // Build settlement
      buildSettlement(currentPlayer.id, Number(vertexId), gameRoom!.id);
      
      // Reset state
      setUiState({
        selectedVertex: null,
        selectedEdge: null,
        hoveredVertex: null,
        hoveredEdge: null,
        buildMode: null,
        roadStartVertex: null,
        validVertices: new Set(),
        validEdges: new Set(),
      });
    } else if (uiState.buildMode === 'road') {
      if (uiState.roadStartVertex === null) {
        // Set start vertex
        setUiState(prev => ({
          ...prev,
          roadStartVertex: vertexId,
          selectedVertex: vertexId,
        }));
      } else if (uiState.roadStartVertex === vertexId) {
        // Deselect
        setUiState(prev => ({
          ...prev,
          roadStartVertex: null,
          selectedVertex: null,
        }));
      } else {
        // Check if there's an edge between them
        const edge = edges.find(e => 
          (e.vertexA === uiState.roadStartVertex && e.vertexB === vertexId) ||
          (e.vertexA === vertexId && e.vertexB === uiState.roadStartVertex)
        );
        
        if (edge && !edge.road) {
          // Build road
          buildRoad(
            currentPlayer.id,
            Number(uiState.roadStartVertex),
            Number(vertexId),
            gameRoom!.id
          );
          
          // Reset state
          setUiState({
            selectedVertex: null,
            selectedEdge: null,
            hoveredVertex: null,
            hoveredEdge: null,
            buildMode: null,
            roadStartVertex: null,
            validVertices: new Set(),
            validEdges: new Set(),
          });
        }
      }
    }
  };

  const handleEdgeClick = (edgeId: EdgeId) => {
    if (uiState.buildMode !== 'road' || !uiState.roadStartVertex || !currentPlayer) return;

    const edge = edges.find(e => e.id === edgeId);
    if (!edge || edge.road) return;

    const connectsToStart = 
      edge.vertexA === uiState.roadStartVertex || 
      edge.vertexB === uiState.roadStartVertex;

    if (connectsToStart) {
      const targetVertexId = 
        edge.vertexA === uiState.roadStartVertex ? edge.vertexB : edge.vertexA;
      
      buildRoad(
        currentPlayer.id,
        Number(uiState.roadStartVertex),
        Number(targetVertexId),
        gameRoom!.id
      );

      setUiState({
        selectedVertex: null,
        selectedEdge: null,
        hoveredVertex: null,
        hoveredEdge: null,
        buildMode: null,
        roadStartVertex: null,
        validVertices: new Set(),
        validEdges: new Set(),
      });
    }
  };

  const handleVertexHover = (vertexId: VertexId | null) => {
    setUiState(prev => ({ ...prev, hoveredVertex: vertexId }));
  };

  const handleEdgeHover = (edgeId: EdgeId | null) => {
    setUiState(prev => ({ ...prev, hoveredEdge: edgeId }));
  };

  // Set build mode from game state
  useEffect(() => {
    if (!gameRoom?.turnState || !currentPlayer) return;

    const isMyTurn = gameRoom.turnState.player === currentPlayer.name;
    const phase = gameRoom.turnState.phase;

    if (isMyTurn && phase === 'Build') {
      // Determine build mode based on UI or defaults
      // This would be set by a build mode selector UI
    }
  }, [gameRoom?.turnState, currentPlayer]);

  if (!gameRoom?.board) {
    return <div className="text-center">Loading board...</div>;
  }

  const { Hexes, Settlements } = gameRoom.board;
  const boardRadius = 2;
  const svgSize = 1.1 * hexSize * (boardRadius * 2 + 1) * Math.sqrt(3);

  return (
    <div className="mb-4">
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`${-svgSize / 2} ${-svgSize / 2} ${svgSize} ${svgSize}`}
      >
        {/* Hex tiles layer */}
        {Hexes.map((hex) => (
          <Hexagon key={hex.id} {...hex} size={hexSize} />
        ))}

        {/* Edges layer */}
        {edges.map((edge) => (
          <BoardEdge
            key={edge.id}
            edge={edge}
            size={hexSize / 8}
            onClick={handleEdgeClick}
            onHover={handleEdgeHover}
            buildMode={uiState.buildMode}
            currentPlayer={currentPlayer}
            selectedEdge={uiState.selectedEdge}
            hoveredEdge={uiState.hoveredEdge}
            validEdges={uiState.validEdges}
            roadStartVertex={uiState.roadStartVertex}
            selectedVertex={uiState.selectedVertex}
          />
        ))}

        {/* Vertices layer */}
        {vertices.map((vertex) => (
          <BoardVertex
            key={vertex.id}
            vertex={vertex}
            size={hexSize}
            onClick={handleVertexClick}
            onHover={handleVertexHover}
            buildMode={uiState.buildMode}
            currentPlayer={currentPlayer}
            selectedVertex={uiState.selectedVertex}
            hoveredVertex={uiState.hoveredVertex}
            validVertices={uiState.validVertices}
            roadStartVertex={uiState.roadStartVertex}
          />
        ))}

        {/* Settlements layer */}
        {Settlements.map((settlement) => {
          const player = gameRoom.players.find((p) => p.name === settlement.owner);
          return (
            <Settlement
              key={settlement.id}
              color={player ? player.color : 'grey'}
              {...settlement}
              size={hexSize}
            />
          );
        })}
      </svg>
    </div>
  );
};

export default BoardView;
