import React, { useState, useEffect, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import { Price, SOCKET_URL } from 'common';

// Socket Context (clean v2 wire protocol: string vertex/edge ids, single edgeId roads)
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  buildSettlement: (playerId: string, vertexId: string, roomId: string) => void;
  buildRoad: (playerId: string, edgeId: string, roomId: string) => void;
  rollDice: (roomId: string) => void;
  joinRoom: (playerName: string, roomId: string, color?: string) => void;
  updatePlayerColor: (roomId: string, color: string) => void;
  makeMove: (position: number, roomId: string) => void;
  startGame: (roomId: string) => void;
  resetGame: (roomId: string) => void;
  refreshMap: (roomId: string) => void;
  endTurn: (playerId: string, roomId: string) => void;
  createTradeOffer: (roomId: string, to: string, give: Price, want: Price) => void;
  acceptTrade: (roomId: string, tradeId: string) => void;
  declineTrade: (roomId: string, tradeId: string) => void;
  cancelTrade: (roomId: string, tradeId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  buildSettlement: () => { },
  buildRoad: () => { },
  rollDice: () => { },
  joinRoom: () => { },
  updatePlayerColor: () => { },
  makeMove: () => { },
  startGame: () => { },
  resetGame: () => { },
  refreshMap: () => { },
  endTurn: () => { },
  createTradeOffer: () => { },
  acceptTrade: () => { },
  declineTrade: () => { },
  cancelTrade: () => { },
});

const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const rollDice = (roomId: string) => {
    if (!socket || !roomId) return;
    socket.emit('rollDice', { roomId });
  };

  const buildSettlement = (playerId: string, vertexId: string, roomId: string) => {
    if (!socket || !roomId) return;
    if (!playerId) {
      console.error('No current player found');
      return;
    }
    socket.emit('buildSettlement', { roomId, playerId, vertexId });
  };

  const buildRoad = (playerId: string, edgeId: string, roomId: string) => {
    if (!socket || !roomId) return;
    if (!playerId) {
      console.error('No current player found');
      return;
    }
    socket.emit('buildRoad', { roomId, playerId, edgeId });
  };

  const endTurn = (playerId: string, roomId: string) => {
    if (!socket || !roomId) return;
    socket.emit('endTurn', { roomId });
  };

  const joinRoom = (playerName: string, roomId: string, color?: string) => {
    if (!socket) return;
    socket.emit('joinRoom', { roomId, playerName, color });
  };

  const updatePlayerColor = (roomId: string, color: string) => {
    if (!socket || !roomId) return;
    socket.emit('updatePlayerColor', { roomId, color });
  };

  const makeMove = (position: number, roomId: string) => {
    if (!socket || !roomId) return;
    socket.emit('makeMove', { roomId, position });
  };

  const startGame = (roomId: string) => {
    if (!socket || !roomId) return;
    socket.emit('startGame', { roomId });
  };

  const resetGame = (roomId: string) => {
    if (!socket || !roomId) return;
    socket.emit('resetGame', { roomId });
  };

  const refreshMap = (roomId: string) => {
    if (!socket || !roomId) return;
    socket.emit('refreshMap', { roomId });
  };

  const createTradeOffer = (roomId: string, to: string, give: Price, want: Price) => {
    if (!socket || !roomId) return;
    socket.emit('createTradeOffer', { roomId, to, give, want });
  };

  const acceptTrade = (roomId: string, tradeId: string) => {
    if (!socket || !roomId) return;
    socket.emit('acceptTrade', { roomId, tradeId });
  };

  const declineTrade = (roomId: string, tradeId: string) => {
    if (!socket || !roomId) return;
    socket.emit('declineTrade', { roomId, tradeId });
  };

  const cancelTrade = (roomId: string, tradeId: string) => {
    if (!socket || !roomId) return;
    socket.emit('cancelTrade', { roomId, tradeId });
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
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        buildSettlement,
        buildRoad,
        rollDice,
        joinRoom,
        updatePlayerColor,
        makeMove,
        startGame,
        resetGame,
        refreshMap,
        endTurn,
        createTradeOffer,
        acceptTrade,
        declineTrade,
        cancelTrade,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

const useSocket = () => useContext(SocketContext);
export { SocketProvider, useSocket };
