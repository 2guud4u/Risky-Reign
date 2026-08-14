import React, { useEffect, useState } from 'react';
import { Board } from 'common/types/Board';
import { BoardUIState } from 'common/types/BoardUI';
import { domainToPresentation } from 'common/adapters/boardAdapter';
import { generateStandardBoard } from 'common/utils/boardGenerator';
import { useBoardInteraction } from '../hooks/useBoardInteraction';
import { BoardVertex } from '../components/BoardVertex';
import { BoardEdge } from '../components/BoardEdge';

interface NewBoardViewProps {
  gameRoom: any;
  currentPlayer: any;
  onBuildSettlement: (vertexId: string) => void;
  onBuildRoad: (edgeId: string) => void;
}

export const NewBoardView: React.FC<NewBoardViewProps> = ({
  gameRoom,
  currentPlayer,
  onBuildSettlement,
  onBuildRoad,
}) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [boardUIState, setBoardUIState] = useState<BoardUIState | null>(null);

  useEffect(() => {
    // Generate board or use from gameRoom
    const generatedBoard = generateStandardBoard();
    setBoard(generatedBoard);
    const uiState = domainToPresentation(generatedBoard);
    setBoardUIState(uiState);
  }, [gameRoom]);

  if (!boardUIState) {
    return <div>Loading board...</div>;
  }

  const interaction = useBoardInteraction(boardUIState);

  const handleVertexClick = (vertexId: string) => {
    interaction.handleVertexClick(vertexId);
    
    if (boardUIState.buildMode === 'settlement' && currentPlayer?.id === gameRoom?.currentPlayerId) {
      onBuildSettlement(vertexId);
    }
  };

  const handleEdgeClick = (edgeId: string) => {
    interaction.handleEdgeClick(edgeId);
    
    if (boardUIState.buildMode === 'road' && currentPlayer?.id === gameRoom?.currentPlayerId) {
      onBuildRoad(edgeId);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '800px' }}>
      <svg width="100%" height="100%" viewBox="0 0 1000 800">
        {/* Render hexes */}
        {Object.values(boardUIState.hexes).map(hex => (
          <g key={hex.id}>
            {/* Hex rendering would go here */}
          </g>
        ))}

        {/* Render edges */}
        {Object.values(interaction.state.edges).map(edge => (
          <BoardEdge
            key={edge.id}
            {...edge}
            onClick={handleEdgeClick}
            onHover={interaction.hoverEdge}
          />
        ))}

        {/* Render vertices */}
        {Object.values(interaction.state.vertices).map(vertex => (
          <BoardVertex
            key={vertex.id}
            {...vertex}
            onClick={handleVertexClick}
            onHover={interaction.hoverVertex}
          />
        ))}
      </svg>

      {/* Build mode indicator */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
      }}>
        <div>Build Mode: {boardUIState.buildMode}</div>
        <div>Selected: {interaction.state.selectedVertexId || interaction.state.selectedEdgeId || 'None'}</div>
      </div>
    </div>
  );
};
