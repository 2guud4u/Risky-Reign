import React from 'react';
import { useGameRoom } from '../../contexts/GameContext';

export const Battle: React.FC = () => {
  const { gameRoom, currentPlayer, selectedObject, setSelectedObject } = useGameRoom();

  if (!gameRoom || !currentPlayer) {
    return <div>Loading...</div>;
  }

  return null;
};