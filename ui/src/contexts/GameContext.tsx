import React, { createContext, useContext, useState } from 'react';
import { GameRoom, Player } from 'common';

interface GameRoomContextValue {
  gameRoom: GameRoom | null;
  setGameRoom: React.Dispatch<React.SetStateAction<GameRoom | null>>;
  currentPlayer: Player | null;
  setCurrentPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
  selectedVertexId: string | null;
  setSelectedVertexId: React.Dispatch<React.SetStateAction<string | null>>;
}

const GameRoomContext = createContext<GameRoomContextValue | undefined>(undefined);

export const GameRoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null);

  return (
    <GameRoomContext.Provider
      value={{ gameRoom, setGameRoom, currentPlayer, setCurrentPlayer, selectedVertexId, setSelectedVertexId }}
    >
      {children}
    </GameRoomContext.Provider>
  );
};

export const useGameRoom = (): GameRoomContextValue => {
  const ctx = useContext(GameRoomContext);
  if (!ctx) throw new Error('useGameRoom must be used within a GameRoomProvider');
  return ctx;
};
