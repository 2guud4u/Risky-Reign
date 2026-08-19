import React from 'react';
import { useGameRoom } from '../../contexts/GameContext';
import Vertex from './Vertex';
import Edge from './Edge';
import { cardClass } from './styles';

/**
 * Sidebar dispatcher: renders the panel for the currently selected board
 * object — a vertex (Build Settlement) or an edge (Build Road).
 */
const Sidebar: React.FC = () => {
  const { gameRoom, currentPlayer, selectedObject } = useGameRoom();
  const board = gameRoom?.board ?? null;

  if (!gameRoom || !currentPlayer || !board) {
    return null;
  }

  if (!selectedObject) {
    return (
      <div className={cardClass}>
        <h3 className="m-0 text-base">Selection</h3>
        <p className="text-[13px] text-gray-500 m-0">
          Click a vertex or edge on the board to see its details and build options.
        </p>
      </div>
    );
  }

  if (selectedObject.type === 'vertex') {
    const vertex = board.vertices[selectedObject.id];
    if (!vertex) return null;
    return <Vertex board={board} vertex={vertex} />;
  }

  const edge = board.edges[selectedObject.id];
  if (!edge) return null;
  return <Edge board={board} edge={edge} />;
};

export default Sidebar;
