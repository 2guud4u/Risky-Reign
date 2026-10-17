import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  DockSpec,
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
/** The wire payload of an event; {roomId} for zero-arg events like quickPlay. */
type EmitPayload<E extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[E]> extends [infer P] ? P : { roomId: string };

const emitAction = <E extends keyof ClientToServerEvents>(
  socket: GameSocket | null,
  event: E,
  payload: { roomId: string }
) => {
  if (!socket || !payload.roomId) return;
  // Loose emit: `E` stays generic here, so the typed `socket.emit` overload
  // can't be satisfied directly — the call sites above are already checked.
  (socket.emit as (ev: string, data: unknown) => void)(event, payload);
};

/**
 * The room actions: each entry maps a friendly argument list to the wire
 * payload for the event of the same name. The provider turns every entry
 * into an emitAction forwarder — one spec, no per-action declarations.
 * `joinRoom` is deliberately absent: it carries session-token logic and is
 * written by hand below.
 */
const actionSpec = {
  buildSettlement: (vertexId: string, roomId: string, asCity?: boolean) => ({
    roomId,
    vertexId,
    ...(asCity ? { asCity } : {}),
  }),
  buildRoad: (edgeId: string, roomId: string) => ({ roomId, edgeId }),
  upgradeSettlementToCity: (vertexId: string, roomId: string) => ({ roomId, vertexId }),
  recruitSoldier: (vertexId: string, roomId: string) => ({ roomId, vertexId }),
  moveSoldier: (soldierId: string, targetVertexId: string, roomId: string) => ({
    roomId,
    soldierId,
    targetVertexId,
  }),
  captureSettlement: (soldierId: string, vertexId: string, roomId: string) => ({
    roomId,
    soldierId,
    vertexId,
  }),
  fightRobber: (soldierId: string, vertexId: string, roomId: string) => ({
    roomId,
    soldierId,
    vertexId,
  }),
  moveRobber: (hexId: string, roomId: string) => ({ roomId, hexId }),
  chooseSteal: (victimName: string, cardIndex: number, roomId: string) => ({
    roomId,
    victimName,
    cardIndex,
  }),
  resolveDiscard: (discards: Record<string, number>, roomId: string) => ({ roomId, discards }),
  resolveDevCardChoice: (resources: string[], roomId: string) => ({ roomId, resources }),
  chooseKnightEffect: (roomId: string, effect: 'robber' | 'spawn' | 'cancel') => ({
    roomId,
    effect,
  }),
  knightSpawnSoldier: (roomId: string, vertexId: string) => ({ roomId, vertexId }),
  healSoldier: (soldierId: string, roomId: string, payWith?: ResourceKey) => ({
    roomId,
    soldierId,
    payWith,
  }),
  startAttack: (soldierIds: string[], targetVertexId: string, roomId: string, defenderName?: string) => ({
    roomId,
    soldierIds,
    targetVertexId,
    defenderName,
  }),
  rollBattleDie: (soldierId: string, roomId: string) => ({ roomId, soldierId }),
  repositionSoldier: (soldierId: string, targetVertexId: string, roomId: string) => ({
    roomId,
    soldierId,
    targetVertexId,
  }),
  finishRepositioning: (roomId: string) => ({ roomId }),
  moveRobberAfterWin: (hexId: string, roomId: string) => ({ roomId, hexId }),
  continueBattle: (roomId: string) => ({ roomId }),
  endBattle: (roomId: string) => ({ roomId }),
  exitBattle: (roomId: string) => ({ roomId }),
  rollDice: (roomId: string) => ({ roomId }),
  endTurn: (roomId: string) => ({ roomId }),
  undoBuild: (roomId: string) => ({ roomId }),
  drawDevelopmentCard: (roomId: string) => ({ roomId }),
  playDevelopmentCard: (roomId: string, cardIndex: number) => ({ roomId, cardIndex }),
  updatePlayerColor: (roomId: string, color: string) => ({ roomId, color }),
  updatePlayerName: (roomId: string, name: string) => ({ roomId, name }),
  startGame: (roomId: string) => ({ roomId }),
  resetGame: (roomId: string) => ({ roomId }),
  setRoomPassword: (roomId: string, password: string) => ({ roomId, password }),
  refreshMap: (roomId: string) => ({ roomId }),
  updatePointsToWin: (roomId: string, pointsToWin: number) => ({ roomId, pointsToWin }),
  setTurnMode: (roomId: string, turnMode: TurnMode) => ({ roomId, turnMode }),
  setSetupCities: (roomId: string, setupCities: number) => ({ roomId, setupCities }),
  setTurnTimer: (roomId: string, turnTimerMs: number) => ({ roomId, turnTimerMs }),
  setRulesLock: (roomId: string, locked: boolean) => ({ roomId, locked }),
  editBoard: (roomId: string, layouts: HexLayout[], docks?: DockSpec[]) => ({ roomId, layouts, docks }),
  leaveGame: (roomId: string) => ({ roomId }),
  claimSeat: (roomId: string, name: string, lobbyPassword?: string) => ({
    roomId,
    name,
    lobbyPassword,
  }),
  spectateRoom: (roomId: string, password?: string) => ({ roomId, password }),
  pauseGame: (roomId: string, hostPassword: string, lobbyPassword: string) => ({
    roomId,
    hostPassword,
    lobbyPassword,
  }),
  openResumeLobby: (roomId: string, hostPassword: string) => ({ roomId, hostPassword }),
  closeResumeLobby: (roomId: string) => ({ roomId }),
  unlockResumeLobby: (roomId: string, lobbyPassword: string) => ({ roomId, lobbyPassword }),
  sendChat: (roomId: string, text: string, to?: string) => ({ roomId, text, to }),
  createTradeOffer: (roomId: string, to: string | null, give: Price, want: Price) => ({
    roomId,
    to,
    give,
    want,
  }),
  acceptTrade: (roomId: string, tradeId: string) => ({ roomId, tradeId }),
  declineTrade: (roomId: string, tradeId: string) => ({ roomId, tradeId }),
  cancelTrade: (roomId: string, tradeId: string) => ({ roomId, tradeId }),
  takeTrade: (roomId: string, tradeId: string) => ({ roomId, tradeId }),
  bankTrade: (roomId: string, giveResource: string, wantResource: string, giveCount: number) => ({
    roomId,
    giveResource,
    wantResource,
    giveCount,
  }),
} satisfies Partial<{
  [E in keyof ClientToServerEvents]: (...args: never[]) => EmitPayload<E>;
}>;

/** The generated room actions, with the spec's friendly signatures. */
type RoomActions = { [K in keyof typeof actionSpec]: (typeof actionSpec)[K] };

interface SocketContextType extends RoomActions {
  socket: GameSocket | null;
  isConnected: boolean;
  /** `asCity`: during setup, place a city directly (room's setup-cities setting). */
  joinRoom: (
    playerName: string,
    roomId: string,
    color?: string,
    layouts?: HexLayout[],
    password?: string
  ) => void;
  /** Find-or-create an open waiting room (the server picks). */
  quickPlay: () => void;
}

const noopActions = Object.keys(actionSpec).reduce(
  (acc, k) => ({ ...acc, [k]: () => {} }),
  {} as RoomActions
);

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinRoom: () => {},
  quickPlay: () => {},
  ...noopActions,
});

const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Every spec entry becomes an emitAction forwarder with the same signature.
  const actions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(actionSpec).map(([event, build]) => [
          event,
          (...args: unknown[]) =>
            emitAction(
              socket,
              event as keyof ClientToServerEvents,
              (build as (...a: unknown[]) => { roomId: string })(...args)
            ),
        ])
      ) as unknown as RoomActions,
    [socket]
  );

  // The join emit, factored so both the exposed action and the
  // `quickPlayFound` listener share it.
  const emitJoin = useCallback(
    (
      s: GameSocket,
      playerName: string,
      roomId: string,
      color?: string,
      layouts?: HexLayout[],
      password?: string
    ) => {
      // Re-attach to our seat after a reload: send the saved token (only
      // when the session is for this exact room — never leak a stale token).
      // Same for the room password the user already answered once.
      const saved = readSavedSession();
      const token = saved && saved.roomId === roomId ? saved.token : undefined;
      const savedPw = saved && saved.roomId === roomId ? saved.password : undefined;
      const pw = password ?? savedPw;
      s.emit('joinRoom', {
        roomId,
        playerName,
        color,
        ...(token ? { token } : {}),
        ...(layouts && layouts.length > 0 ? { layouts } : {}),
        ...(pw ? { password: pw } : {}),
      });
    },
    []
  );

  const joinRoom = (
    playerName: string,
    roomId: string,
    color?: string,
    layouts?: HexLayout[],
    password?: string
  ) => {
    if (!socket) return;
    emitJoin(socket, playerName, roomId, color, layouts, password);
  };

  // Quick Play: ask the server for an open room (or a fresh code), then take
  // the normal joinRoom path with the answer.
  const quickPlay = () => {
    if (!socket) return;
    socket.emit('quickPlay');
  };

  useEffect(() => {
    const newSocket: GameSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    // Mobile browsers suspend/suspend-kill backgrounded tabs, quietly dropping
    // the socket. When the tab becomes visible again, reconnect immediately
    // instead of waiting out the backoff timer (MOBILE_PLAN.md).
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !newSocket.connected) newSocket.connect();
    };
    document.addEventListener('visibilitychange', onVisible);

    // The server hands each joined socket a secret seat token; persist it so
    // a reload can re-attach to the same seat instead of joining as new.
    newSocket.on('joined', (data) => {
      const saved = readSavedSession();
      if (saved) saveSession({ ...saved, token: data.token });
    });

    // Quick Play landed: join the code it found through the normal path.
    newSocket.on('quickPlayFound', (data) => {
      emitJoin(newSocket, '', data.roomId);
      // Persist the join so a reload auto-rejoins (same as a manual join).
      const saved = readSavedSession();
      saveSession({
        roomId: data.roomId,
        playerName: '',
        ...(saved?.roomId === data.roomId ? { token: saved.token } : {}),
      });
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      newSocket.close();
    };
  }, [emitJoin]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinRoom,
        quickPlay,
        ...actions,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

const useSocket = () => useContext(SocketContext);
export { SocketProvider, useSocket };
