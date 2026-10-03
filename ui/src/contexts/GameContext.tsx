import React, { createContext, useContext, useState } from 'react';
import { PublicGameRoom, PublicPlayer } from 'common';
import { SelectableObject } from '../types';
interface GameRoomContextValue {
  gameRoom: PublicGameRoom | null;
  setGameRoom: React.Dispatch<React.SetStateAction<PublicGameRoom | null>>;
  currentPlayer: PublicPlayer | null;
  setCurrentPlayer: React.Dispatch<React.SetStateAction<PublicPlayer | null>>;
  selectedObject: SelectableObject | null;
  setSelectedObject: React.Dispatch<React.SetStateAction<SelectableObject | null>>;
  /** Soldiers picked (by tapping them on the map) for a group action on the selected vertex. */
  selectedSoldierIds: string[];
  setSelectedSoldierIds: React.Dispatch<React.SetStateAction<string[]>>;
}

const GameRoomContext = createContext<GameRoomContextValue | undefined>(undefined);

export const GameRoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameRoom, setGameRoom] = useState<PublicGameRoom | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<PublicPlayer | null>(null);
  const [selectedObject, setSelectedObject] = useState<SelectableObject | null>(null);
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<string[]>([]);
  return (
    <GameRoomContext.Provider
      value={{
        gameRoom,
        setGameRoom,
        currentPlayer,
        setCurrentPlayer,
        selectedObject,
        setSelectedObject,
        selectedSoldierIds,
        setSelectedSoldierIds,
      }}
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
