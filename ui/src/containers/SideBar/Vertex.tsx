import React from 'react';
import { VertexInfo } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
export const Vertex: React.FC<{ vertex: VertexInfo }> = ({ vertex }) => {
  const { gameRoom, currentPlayer, selectedObject, setSelectedObject } = useGameRoom();
  return null;
};
