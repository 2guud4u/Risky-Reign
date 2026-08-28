import React, { useState, useEffect, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import { Price, SOCKET_URL } from 'common';

/**
 * Generic emit helper: guards against a missing socket/roomId and validates
 * the required playerId (when provided), then emits the event. Keeps each
 * action function a one-liner instead of repeating the same boilerplate.
 */
const emitAction = (
  socket: Socket | null,
  event: string,
  payload: Record<string, unknown>,
  { requirePlayerId = false }: { requirePlayerId?: boolean } = {}
) => {
  if (!socket || !payload.roomId) return;
  if (requirePlayerId && !payload.playerId) {
    console.error(`No current player found for ${event}`);
    return;
  }
  socket.emit(event, payload);
};

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  buildSettlement: (playerId: string, vertexId: string, roomId: string) => void;
  buildRoad: (playerId: string, edgeId: string, roomId: string) => void;
  upgradeSettlementToCity: (playerId: string, vertexId: string, roomId: string) => void;
  buildSoldier: (playerId: string, vertexId: string, roomId: string) => void;
  moveSoldier: (playerId: string, soldierId: string, targetVertexId: string, roomId: string) => void;
  healSoldier: (playerId: string, soldierId: string, roomId: string) => void;
  startAttack: (playerId: string, soldierIds: string[], targetVertexId: string, roomId: string) => void;
  rollBattleDie: (playerId: string, soldierId: string, roomId: string) => void;
  repositionSoldier: (playerId: string, soldierId: string, targetVertexId: string, roomId: string) => void;
  continueBattle: (playerId: string, roomId: string) => void;
  endBattle: (playerId: string, roomId: string) => void;
  exitBattle: (roomId: string) => void;
  rollDice: (roomId: string) => void;
  joinRoom: (playerName: string, roomId: string, color?: string) => void;
  updatePlayerColor: (roomId: string, color: string) => void;
  makeMove: (position: number, roomId: string) => void;
  startGame: (roomId: string) => void;
  resetGame: (roomId: string) => void;
  refreshMap: (roomId: string) => void;
  endTurn: (roomId: string) => void;
  drawDevelopmentCard: (playerId: string, roomId: string) => void;
  playDevelopmentCard: (playerId: string, roomId: string, cardIndex: number) => void;
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
  upgradeSettlementToCity: () => { },
  buildSoldier: () => { },
  moveSoldier: () => { },
  healSoldier: () => { },
  startAttack: () => { },
  rollBattleDie: () => { },
  repositionSoldier: () => { },
  continueBattle: () => { },
  endBattle: () => { },
  exitBattle: () => { },
  rollDice: () => { },
  joinRoom: () => { },
  updatePlayerColor: () => { },
  makeMove: () => { },
  startGame: () => { },
  resetGame: () => { },
  refreshMap: () => { },
  endTurn: () => { },
  drawDevelopmentCard: () => { },
  playDevelopmentCard: () => { },
  createTradeOffer: () => { },
  acceptTrade: () => { },
  declineTrade: () => { },
  cancelTrade: () => { },
});

const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const buildSettlement = (playerId: string, vertexId: string, roomId: string) =>
    emitAction(socket, 'buildSettlement', { roomId, playerId, vertexId }, { requirePlayerId: true });

  const buildRoad = (playerId: string, edgeId: string, roomId: string) =>
    emitAction(socket, 'buildRoad', { roomId, playerId, edgeId }, { requirePlayerId: true });

  const upgradeSettlementToCity = (playerId: string, vertexId: string, roomId: string) =>
    emitAction(socket, 'upgradeSettlementToCity', { roomId, playerId, vertexId }, { requirePlayerId: true });

  const buildSoldier = (playerId: string, vertexId: string, roomId: string) =>
    emitAction(socket, 'buildSoldier', { roomId, playerId, vertexId }, { requirePlayerId: true });

  const moveSoldier = (playerId: string, soldierId: string, targetVertexId: string, roomId: string) =>
    emitAction(socket, 'moveSoldier', { roomId, playerId, soldierId, targetVertexId }, { requirePlayerId: true });

  const healSoldier = (playerId: string, soldierId: string, roomId: string) =>
    emitAction(socket, 'healSoldier', { roomId, playerId, soldierId }, { requirePlayerId: true });

  const startAttack = (playerId: string, soldierIds: string[], targetVertexId: string, roomId: string) =>
    emitAction(socket, 'startAttack', { roomId, playerId, soldierIds, targetVertexId }, { requirePlayerId: true });

  const rollBattleDie = (playerId: string, soldierId: string, roomId: string) =>
    emitAction(socket, 'rollBattleDie', { roomId, playerId, soldierId }, { requirePlayerId: true });

  const repositionSoldier = (playerId: string, soldierId: string, targetVertexId: string, roomId: string) =>
    emitAction(
      socket,
      'repositionSoldier',
      { roomId, playerId, soldierId, targetVertexId },
      { requirePlayerId: true }
    );

  const continueBattle = (playerId: string, roomId: string) =>
    emitAction(socket, 'continueBattle', { roomId, playerId }, { requirePlayerId: true });

  const endBattle = (playerId: string, roomId: string) =>
    emitAction(socket, 'endBattle', { roomId, playerId }, { requirePlayerId: true });

  const exitBattle = (roomId: string) =>
    emitAction(socket, 'exitBattle', { roomId }, { requirePlayerId: false });

  const endTurn = (roomId: string) => emitAction(socket, 'endTurn', { roomId });

  const drawDevelopmentCard = (playerId: string, roomId: string) =>
    emitAction(socket, 'drawDevelopmentCard', { roomId, playerId }, { requirePlayerId: true });

  const playDevelopmentCard = (playerId: string, roomId: string, cardIndex: number) =>
    emitAction(socket, 'playDevelopmentCard', { roomId, playerId, cardIndex }, { requirePlayerId: true });

  const rollDice = (roomId: string) => emitAction(socket, 'rollDice', { roomId });

  const joinRoom = (playerName: string, roomId: string, color?: string) => {
    if (!socket) return;
    socket.emit('joinRoom', { roomId, playerName, color });
  };

  const updatePlayerColor = (roomId: string, color: string) =>
    emitAction(socket, 'updatePlayerColor', { roomId, color });

  const makeMove = (position: number, roomId: string) =>
    emitAction(socket, 'makeMove', { roomId, position });

  const startGame = (roomId: string) => emitAction(socket, 'startGame', { roomId });

  const resetGame = (roomId: string) => emitAction(socket, 'resetGame', { roomId });

  const refreshMap = (roomId: string) => emitAction(socket, 'refreshMap', { roomId });

  const createTradeOffer = (roomId: string, to: string, give: Price, want: Price) =>
    emitAction(socket, 'createTradeOffer', { roomId, to, give, want });

  const acceptTrade = (roomId: string, tradeId: string) =>
    emitAction(socket, 'acceptTrade', { roomId, tradeId });

  const declineTrade = (roomId: string, tradeId: string) =>
    emitAction(socket, 'declineTrade', { roomId, tradeId });

  const cancelTrade = (roomId: string, tradeId: string) =>
    emitAction(socket, 'cancelTrade', { roomId, tradeId });

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
        upgradeSettlementToCity,
        buildSoldier,
        moveSoldier,
        healSoldier,
        startAttack,
        rollBattleDie,
        repositionSoldier,
        continueBattle,
        endBattle,
        exitBattle,
        rollDice,
        joinRoom,
        updatePlayerColor,
        makeMove,
        startGame,
        resetGame,
        refreshMap,
        endTurn,
        drawDevelopmentCard,
        playDevelopmentCard,
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
