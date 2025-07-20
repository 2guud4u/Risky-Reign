import React, { useState, useEffect, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
const SOCKET_URL = 'http://localhost:3001';

// Socket Context
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  buildSettlement: (playerId: string, intersectId: number, currentRoomId: string) => void;
  rollDice: () => void;
  joinRoom: (playerName: string, roomId: string) => void;
  makeMove: (position: number, currentRoomId: string) => void;
  startGame: (currentRoomId: string) => void;
  resetGame: (currentRoomId: string) => void;
  refreshMap: (currentRoomId: string) => void;
  endTurn: (playerId: string, currentRoomId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  buildSettlement: () => {},
  rollDice: () => {},
  joinRoom: () => {},
  makeMove: () => {},
  startGame: () => {},
  resetGame: () => {},
  refreshMap: () => {},
  endTurn: () => {},
});

const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // game actions

  const rollDice = () => {
    if (!socket) return;
    socket.emit('rollDice');
  };
  const buildSettlement = (playerId: string,intersectId: number, currentRoomId: string) => {
    if (!socket || !currentRoomId) return;
    console.log('Building settlement at intersect:', intersectId);
    if (!playerId) {
      console.error('No current player found');
      return;
    }
    socket.emit('buildSettlement', { roomId: currentRoomId, playerId: playerId, intersectId });
  };

  const endTurn = (playerId: string | undefined, currentRoomId: string | undefined) => {
    if (!socket || !currentRoomId) return;
    socket.emit('endTurn', { roomId: currentRoomId });
  };
  const joinRoom = (playerName: string, roomId: string) => {
    if (!socket) return;

    socket.emit('joinRoom', { roomId, playerName });
  };

  const makeMove = (position: number, currentRoomId: string) => {
    if (!socket || !currentRoomId) return;
    
    socket.emit('makeMove', { roomId: currentRoomId, position });
  };

  const startGame = ( currentRoomId: string) => {
    if (!socket || !currentRoomId) return;
    socket.emit('startGame', { roomId: currentRoomId });

  };

  const resetGame = (currentRoomId: string) => {
    if (!socket || !currentRoomId) return;
    
    socket.emit('resetGame', { roomId: currentRoomId });
  };

  const refreshMap = (currentRoomId: string) => {
    if (!socket || !currentRoomId) return;

    socket.emit('refreshMap', { roomId: currentRoomId });
  };

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, buildSettlement, rollDice, joinRoom, makeMove, startGame, resetGame, refreshMap, endTurn }}>
      {children}
    </SocketContext.Provider>
  );
};
const useSocket = () => useContext(SocketContext);
export 
{ SocketProvider, useSocket };