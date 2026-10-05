import React, { useState, useEffect, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  HexLayout,
  Price,
  ResourceKey,
  ServerToClientEvents,
  TurnMode,
} from 'common';
import { SOCKET_URL } from '../config';
import { readSavedSession, saveSession } from '../utils/session';

/**
 * Client socket bound to the shared event contract: it listens for
 * ServerToClientEvents and emits ClientToServerEvents.
 */
type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Emit a room action if we have a live socket and a roomId. The server knows
 * the caller by socket.id, so payloads never carry an identity — just roomId
 * and the event's own fields.
 */
const emitAction = <E extends keyof ClientToServerEvents>(
  socket: GameSocket | null,
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0]
) => {
  if (!socket || !payload.roomId) return;
  // Loose emit: `E` stays generic here, so the typed `socket.emit` overload
  // can't be satisfied directly — the call sites above are already checked.
  (socket.emit as (ev: string, data: unknown) => void)(event, payload);
};

interface SocketContextType {
  socket: GameSocket | null;
  isConnected: boolean;
  buildSettlement: (vertexId: string, roomId: string) => void;
  buildRoad: (edgeId: string, roomId: string) => void;
  upgradeSettlementToCity: (vertexId: string, roomId: string) => void;
  recruitSoldier: (vertexId: string, roomId: string) => void;
  moveSoldier: (soldierId: string, targetVertexId: string, roomId: string) => void;
  captureSettlement: (soldierId: string, vertexId: string, roomId: string) => void;
  fightRobber: (soldierId: string, vertexId: string, roomId: string) => void;
  moveRobber: (hexId: string, roomId: string) => void;
  chooseSteal: (victimName: string, cardIndex: number, roomId: string) => void;
  resolveDiscard: (discards: Record<string, number>, roomId: string) => void;
  resolveDevCardChoice: (resources: string[], roomId: string) => void;
  chooseKnightEffect: (roomId: string, effect: 'robber' | 'spawn' | 'cancel') => void;
  knightSpawnSoldier: (roomId: string, vertexId: string) => void;
  healSoldier: (soldierId: string, roomId: string, payWith?: ResourceKey) => void;
  startAttack: (soldierIds: string[], targetVertexId: string, roomId: string, defenderName?: string) => void;
  rollBattleDie: (soldierId: string, roomId: string) => void;
  repositionSoldier: (soldierId: string, targetVertexId: string, roomId: string) => void;
  finishRepositioning: (roomId: string) => void;
  moveRobberAfterWin: (hexId: string, roomId: string) => void;
  continueBattle: (roomId: string) => void;
  endBattle: (roomId: string) => void;
  exitBattle: (roomId: string) => void;
  rollDice: (roomId: string) => void;
  joinRoom: (playerName: string, roomId: string, color?: string, layouts?: HexLayout[]) => void;
  updatePlayerColor: (roomId: string, color: string) => void;
  updatePlayerName: (roomId: string, name: string) => void;
  startGame: (roomId: string) => void;
  resetGame: (roomId: string) => void;
  refreshMap: (roomId: string) => void;
  updatePointsToWin: (roomId: string, pointsToWin: number) => void;
  editBoard: (roomId: string, layouts: HexLayout[]) => void;
  endTurn: (roomId: string) => void;
  undoBuild: (roomId: string) => void;
  drawDevelopmentCard: (roomId: string) => void;
  playDevelopmentCard: (roomId: string, cardIndex: number) => void;
  setTurnMode: (roomId: string, turnMode: TurnMode) => void;
  createTradeOffer: (roomId: string, to: string | null, give: Price, want: Price) => void;
  acceptTrade: (roomId: string, tradeId: string) => void;
  declineTrade: (roomId: string, tradeId: string) => void;
  cancelTrade: (roomId: string, tradeId: string) => void;
  takeTrade: (roomId: string, tradeId: string) => void;
  bankTrade: (roomId: string, giveResource: string, wantResource: string, giveCount: number) => void;
  leaveGame: (roomId: string) => void;
  claimSeat: (roomId: string, name: string) => void;
  spectateRoom: (roomId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  buildSettlement: () => {},
  buildRoad: () => {},
  upgradeSettlementToCity: () => {},
  recruitSoldier: () => {},
  moveSoldier: () => {},
  captureSettlement: () => {},
  fightRobber: () => {},
  moveRobber: () => {},
  chooseSteal: () => {},
  resolveDiscard: () => {},
  resolveDevCardChoice: () => {},
  chooseKnightEffect: () => {},
  knightSpawnSoldier: () => {},
  healSoldier: () => {},
  startAttack: () => {},
  rollBattleDie: () => {},
  repositionSoldier: () => {},
  finishRepositioning: () => {},
  moveRobberAfterWin: () => {},
  continueBattle: () => {},
  endBattle: () => {},
  exitBattle: () => {},
  rollDice: () => {},
  joinRoom: () => {},
  updatePlayerColor: () => {},
  updatePlayerName: () => {},
  startGame: () => {},
  resetGame: () => {},
  refreshMap: () => {},
  updatePointsToWin: () => {},
  editBoard: () => {},
  endTurn: () => {},
  undoBuild: () => {},
  drawDevelopmentCard: () => {},
  playDevelopmentCard: () => {},
  createTradeOffer: () => {},
  acceptTrade: () => {},
  declineTrade: () => {},
  cancelTrade: () => {},
  takeTrade: () => {},
  bankTrade: () => {},
  leaveGame: () => {},
  claimSeat: () => {},
  spectateRoom: () => {},
  setTurnMode: () => {},
});

const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const buildSettlement = (vertexId: string, roomId: string) =>
    emitAction(socket, 'buildSettlement', { roomId, vertexId });
  const buildRoad = (edgeId: string, roomId: string) =>
    emitAction(socket, 'buildRoad', { roomId, edgeId });
  const upgradeSettlementToCity = (vertexId: string, roomId: string) =>
    emitAction(socket, 'upgradeSettlementToCity', { roomId, vertexId });
  const recruitSoldier = (vertexId: string, roomId: string) =>
    emitAction(socket, 'recruitSoldier', { roomId, vertexId });
  const moveSoldier = (soldierId: string, targetVertexId: string, roomId: string) =>
    emitAction(socket, 'moveSoldier', { roomId, soldierId, targetVertexId });
  const captureSettlement = (soldierId: string, vertexId: string, roomId: string) =>
    emitAction(socket, 'captureSettlement', { roomId, soldierId, vertexId });
  const fightRobber = (soldierId: string, vertexId: string, roomId: string) =>
    emitAction(socket, 'fightRobber', { roomId, soldierId, vertexId });
  const moveRobber = (hexId: string, roomId: string) =>
    emitAction(socket, 'moveRobber', { roomId, hexId });
  const chooseSteal = (victimName: string, cardIndex: number, roomId: string) =>
    emitAction(socket, 'chooseSteal', { roomId, victimName, cardIndex });
  const resolveDiscard = (discards: Record<string, number>, roomId: string) =>
    emitAction(socket, 'resolveDiscard', { roomId, discards });
  const resolveDevCardChoice = (resources: string[], roomId: string) =>
    emitAction(socket, 'resolveDevCardChoice', { roomId, resources });
  const chooseKnightEffect = (roomId: string, effect: 'robber' | 'spawn' | 'cancel') =>
    emitAction(socket, 'chooseKnightEffect', { roomId, effect });
  const knightSpawnSoldier = (roomId: string, vertexId: string) =>
    emitAction(socket, 'knightSpawnSoldier', { roomId, vertexId });
  const healSoldier = (soldierId: string, roomId: string, payWith?: ResourceKey) =>
    emitAction(socket, 'healSoldier', { roomId, soldierId, payWith });
  const startAttack = (soldierIds: string[], targetVertexId: string, roomId: string, defenderName?: string) =>
    emitAction(socket, 'startAttack', { roomId, soldierIds, targetVertexId, defenderName });
  const rollBattleDie = (soldierId: string, roomId: string) =>
    emitAction(socket, 'rollBattleDie', { roomId, soldierId });
  const repositionSoldier = (soldierId: string, targetVertexId: string, roomId: string) =>
    emitAction(socket, 'repositionSoldier', { roomId, soldierId, targetVertexId });
  const finishRepositioning = (roomId: string) =>
    emitAction(socket, 'finishRepositioning', { roomId });
  const moveRobberAfterWin = (hexId: string, roomId: string) =>
    emitAction(socket, 'moveRobberAfterWin', { roomId, hexId });
  const continueBattle = (roomId: string) =>
    emitAction(socket, 'continueBattle', { roomId });
  const endBattle = (roomId: string) =>
    emitAction(socket, 'endBattle', { roomId });
  const exitBattle = (roomId: string) => emitAction(socket, 'exitBattle', { roomId });
  const rollDice = (roomId: string) => emitAction(socket, 'rollDice', { roomId });
  const endTurn = (roomId: string) => emitAction(socket, 'endTurn', { roomId });
  const undoBuild = (roomId: string) => emitAction(socket, 'undoBuild', { roomId });
  const drawDevelopmentCard = (roomId: string) =>
    emitAction(socket, 'drawDevelopmentCard', { roomId });
  const playDevelopmentCard = (roomId: string, cardIndex: number) =>
    emitAction(socket, 'playDevelopmentCard', { roomId, cardIndex });

  const joinRoom = (playerName: string, roomId: string, color?: string, layouts?: HexLayout[]) => {
    if (!socket) return;
    // Re-attach to our seat after a reload: send the saved token (only when
    // the session is for this exact room — never leak a stale token).
    const saved = readSavedSession();
    const token = saved && saved.roomId === roomId ? saved.token : undefined;
    socket.emit('joinRoom', {
      roomId,
      playerName,
      color,
      ...(token ? { token } : {}),
      ...(layouts && layouts.length > 0 ? { layouts } : {}),
    });
  };

  const updatePlayerColor = (roomId: string, color: string) =>
    emitAction(socket, 'updatePlayerColor', { roomId, color });
  const updatePlayerName = (roomId: string, name: string) =>
    emitAction(socket, 'updatePlayerName', { roomId, name });
  const startGame = (roomId: string) => emitAction(socket, 'startGame', { roomId });
  const resetGame = (roomId: string) => emitAction(socket, 'resetGame', { roomId });
  const refreshMap = (roomId: string) => emitAction(socket, 'refreshMap', { roomId });
  const updatePointsToWin = (roomId: string, pointsToWin: number) =>
    emitAction(socket, 'updatePointsToWin', { roomId, pointsToWin });
  const setTurnMode = (roomId: string, turnMode: TurnMode) =>
    emitAction(socket, 'setTurnMode', { roomId, turnMode });
  const editBoard = (roomId: string, layouts: HexLayout[]) =>
    emitAction(socket, 'editBoard', { roomId, layouts });
  const leaveGame = (roomId: string) => emitAction(socket, 'leaveGame', { roomId });
  const claimSeat = (roomId: string, name: string) => emitAction(socket, 'claimSeat', { roomId, name });
  const spectateRoom = (roomId: string) => emitAction(socket, 'spectateRoom', { roomId });
  const createTradeOffer = (roomId: string, to: string | null, give: Price, want: Price) =>
    emitAction(socket, 'createTradeOffer', { roomId, to, give, want });
  const acceptTrade = (roomId: string, tradeId: string) =>
    emitAction(socket, 'acceptTrade', { roomId, tradeId });
  const declineTrade = (roomId: string, tradeId: string) =>
    emitAction(socket, 'declineTrade', { roomId, tradeId });
  const cancelTrade = (roomId: string, tradeId: string) =>
    emitAction(socket, 'cancelTrade', { roomId, tradeId });
  const takeTrade = (roomId: string, tradeId: string) =>
    emitAction(socket, 'takeTrade', { roomId, tradeId });
  const bankTrade = (roomId: string, giveResource: string, wantResource: string, giveCount: number) =>
    emitAction(socket, 'bankTrade', { roomId, giveResource, wantResource, giveCount });

  useEffect(() => {
    const newSocket: GameSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    // The server hands each joined socket a secret seat token; persist it so
    // a reload can re-attach to the same seat instead of joining as new.
    newSocket.on('joined', (data) => {
      const saved = readSavedSession();
      if (saved) saveSession({ ...saved, token: data.token });
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
        recruitSoldier,
        moveSoldier,
        captureSettlement,
        fightRobber,
        moveRobber,
        chooseSteal,
        resolveDiscard,
        resolveDevCardChoice,
        chooseKnightEffect,
        knightSpawnSoldier,
        healSoldier,
        startAttack,
        rollBattleDie,
        repositionSoldier,
        finishRepositioning,
        moveRobberAfterWin,
        continueBattle,
        endBattle,
        exitBattle,
        rollDice,
        joinRoom,
        updatePlayerColor,
        updatePlayerName,
        startGame,
        resetGame,
        refreshMap,
        updatePointsToWin,
        setTurnMode,
        editBoard,
        leaveGame,
        claimSeat,
        spectateRoom,
        endTurn,
        undoBuild,
        drawDevelopmentCard,
        playDevelopmentCard,
        createTradeOffer,
        acceptTrade,
        declineTrade,
        cancelTrade,
        takeTrade,
        bankTrade,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

const useSocket = () => useContext(SocketContext);
export { SocketProvider, useSocket };
