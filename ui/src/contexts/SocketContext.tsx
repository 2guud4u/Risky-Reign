import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ResourceKey,
  TurnMode,
  HexLayout,
  DockSpec,
  Price,
} from 'common';
import { readSavedSession, saveSession } from '../utils/session';

/**
 * Client socket bound to the shared event contract: it listens for
 * ServerToClientEvents and emits ClientToServerEvents.
 */
type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** The wire payload of an event; {roomId} for zero-arg events like quickPlay. */
type EmitPayload<E extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[E]> extends [infer P] ? P : { roomId: string };

/**
 * Emit a room action if we have a live socket and a roomId. The server knows
 * the caller by socket.id, so payloads never carry an identity — just roomId
 * and the event's own fields.
 */
const emitAction = <E extends keyof ClientToServerEvents>(
  socket: GameSocket | null,
  event: E,
  payload: { roomId: string; [field: string]: unknown }
) => {
  if (!socket || !payload.roomId) return;
  // Loose emit: `E` stays generic here, so the typed `socket.emit` overload
  // can't be satisfied directly — the call sites above are already checked.
  (socket.emit as (ev: string, data: unknown) => void)(event, payload);
};

/**
 * The in-room actions: each entry maps a friendly argument list to the wire
 * payload for the event of the same name, minus `roomId` — the provider
 * injects the joined room's id, so callers never thread `gameRoom.id` through.
 * `joinRoom` is deliberately absent: it carries session-token logic and is
 * written by hand below, as are the actions that join/leave a room.
 */
const actionSpec = {
  buildSettlement: (vertexId: string, asCity?: boolean) => ({
    vertexId,
    ...(asCity ? { asCity } : {}),
  }),
  buildRoad: (edgeId: string) => ({ edgeId }),
  upgradeSettlementToCity: (vertexId: string) => ({ vertexId }),
  recruitSoldier: (vertexId: string) => ({ vertexId }),
  moveSoldier: (soldierId: string, targetVertexId: string) => ({ soldierId, targetVertexId }),
  captureSettlement: (soldierId: string, vertexId: string) => ({ soldierId, vertexId }),
  upgradeCannon: (soldierId: string) => ({ soldierId }),
  downgradeCannon: (soldierId: string) => ({ soldierId }),
  stationCannon: (soldierId: string) => ({ soldierId }),
  unstationCannon: (soldierId: string) => ({ soldierId }),
  cannonAttack: (soldierId: string, targetSoldierId: string) => ({ soldierId, targetSoldierId }),
  cannonSplash: (soldierId: string, vertexId: string) => ({ soldierId, vertexId }),
  cannonAttackWall: (soldierId: string, edgeId: string) => ({ soldierId, edgeId }),
  upgradeRoadToWall: (edgeId: string) => ({ edgeId }),
  wallGuess: (guess: number) => ({ guess }),
  rollWallGate: () => ({}),
  buildShip: (vertexId: string) => ({ vertexId }),
  moveShip: (shipId: string, vertexId: string) => ({ shipId, vertexId }),
  embarkSoldier: (soldierId: string, shipId: string) => ({ soldierId, shipId }),
  disembarkSoldier: (soldierId: string, vertexId: string) => ({ soldierId, vertexId }),
  convertShipToSettlement: (shipId: string, vertexId: string) => ({ shipId, vertexId }),
  setPiecesEnabled: (pieces: { cannons?: boolean; walls?: boolean; ships?: boolean }) => pieces,
  fightRobber: (soldierId: string, vertexId: string) => ({ soldierId, vertexId }),
  moveRobber: (hexId: string) => ({ hexId }),
  chooseSteal: (victimName: string, cardIndex: number) => ({ victimName, cardIndex }),
  resolveDiscard: (discards: Record<string, number>) => ({ discards }),
  resolveDevCardChoice: (resources: string[]) => ({ resources }),
  chooseKnightEffect: (effect: 'robber' | 'spawn' | 'cancel') => ({ effect }),
  knightSpawnSoldier: (vertexId: string) => ({ vertexId }),
  healSoldier: (soldierId: string, payWith?: ResourceKey) => ({ soldierId, payWith }),
  startAttack: (soldierIds: string[], targetVertexId: string, defenderName?: string) => ({
    soldierIds,
    targetVertexId,
    defenderName,
  }),
  rollBattleDie: (soldierId: string) => ({ soldierId }),
  repositionSoldier: (soldierId: string, targetVertexId: string) => ({ soldierId, targetVertexId }),
  finishRepositioning: () => ({}),
  moveRobberAfterWin: (hexId: string) => ({ hexId }),
  continueBattle: () => ({}),
  endBattle: () => ({}),
  exitBattle: () => ({}),
  rollDice: () => ({}),
  endTurn: () => ({}),
  undoBuild: () => ({}),
  drawDevelopmentCard: () => ({}),
  playDevelopmentCard: (cardIndex: number) => ({ cardIndex }),
  updatePlayerColor: (color: string) => ({ color }),
  updatePlayerName: (name: string) => ({ name }),
  // An explicit arg overrides the bound room: the resuming lobby on the
  // paused screen may not be the room the socket last joined.
  startGame: (roomId?: string) => (roomId ? { roomId } : {}),
  resetGame: () => ({}),
  setRoomPassword: (password: string) => ({ password }),
  refreshMap: () => ({}),
  updatePointsToWin: (pointsToWin: number) => ({ pointsToWin }),
  setTurnMode: (turnMode: TurnMode) => ({ turnMode }),
  setSetupCities: (setupCities: number) => ({ setupCities }),
  setTurnTimer: (turnTimerMs: number) => ({ turnTimerMs }),
  setRulesLock: (locked: boolean) => ({ locked }),
  editBoard: (layouts: HexLayout[], docks?: DockSpec[]) => ({ layouts, docks }),
  sendChat: (text: string, to?: string) => ({ text, to }),
  createTradeOffer: (to: string | null, give: Price, want: Price) => ({ to, give, want }),
  acceptTrade: (tradeId: string) => ({ tradeId }),
  declineTrade: (tradeId: string) => ({ tradeId }),
  cancelTrade: (tradeId: string) => ({ tradeId }),
  takeTrade: (tradeId: string) => ({ tradeId }),
  bankTrade: (giveResource: string, wantResource: string, giveCount: number) => ({
    giveResource,
    wantResource,
    giveCount,
  }),
} satisfies Partial<{
  [E in keyof ClientToServerEvents]: (...args: never[]) => Omit<EmitPayload<E>, 'roomId'>;
}>;

/**
 * Addressed actions: they target a room the socket may not be joined to yet
 * (claiming a seat in a resuming lobby, spectating, reopening a paused game),
 * so they keep an explicit leading `roomId`.
 */
const addressedActionSpec = {
  openResumeLobby: (roomId: string, hostPassword: string) => ({ roomId, hostPassword }),
  closeResumeLobby: (roomId: string) => ({ roomId }),
  unlockResumeLobby: (roomId: string, lobbyPassword: string) => ({ roomId, lobbyPassword }),
} satisfies Partial<{
  [E in keyof ClientToServerEvents]: (...args: never[]) => EmitPayload<E>;
}>;

/** The generated room actions, with the specs' friendly signatures. */
type RoomActions = { [K in keyof typeof actionSpec]: (typeof actionSpec)[K] };
type AddressedActions = { [K in keyof typeof addressedActionSpec]: (typeof addressedActionSpec)[K] };

interface SocketContextType extends RoomActions, AddressedActions {
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
  /** Watch a room without a seat. */
  spectateRoom: (roomId: string, password?: string) => void;
  /** Take a named seat in a resuming lobby. */
  claimSeat: (roomId: string, name: string, lobbyPassword?: string) => void;
  /** Leave the joined room (the server keeps the seat, marked disconnected). */
  leaveGame: () => void;
  /** Host: pause this game for later (two passwords: reopen + seat claims). */
  pauseGame: (hostPassword: string, lobbyPassword: string) => void;
}

const noopActions = Object.fromEntries(
  Object.keys({ ...actionSpec, ...addressedActionSpec }).map((k) => [k, () => {}])
) as unknown as RoomActions & AddressedActions;

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinRoom: () => {},
  quickPlay: () => {},
  spectateRoom: () => {},
  claimSeat: () => {},
  leaveGame: () => {},
  pauseGame: () => {},
  ...noopActions,
});

const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // The room every bound action targets: the last one we joined (or
  // spectated / claimed a seat in). A ref, not state: no action emit ever
  // needs a re-render, and forwarders built before the join still read it.
  const joinedRoomIdRef = useRef<string>('');

  // Every bound spec entry becomes an emitAction forwarder with the same
  // signature; roomId comes from the joined room.
  const actions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(actionSpec).map(([event, build]) => [
          event,
          (...args: unknown[]) =>
            emitAction(
              socket,
              event as keyof ClientToServerEvents,
              {
                roomId: joinedRoomIdRef.current,
                ...(build as (...a: unknown[]) => object)(...args),
              }
            ),
        ])
      ) as unknown as RoomActions,
    [socket]
  );

  // Addressed actions emit to the room named by the caller.
  const addressedActions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(addressedActionSpec).map(([event, build]) => [
          event,
          (...args: unknown[]) =>
            emitAction(
              socket,
              event as keyof ClientToServerEvents,
              (build as (...a: unknown[]) => { roomId: string })(...args)
            ),
        ])
      ) as unknown as AddressedActions,
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
      joinedRoomIdRef.current = roomId;
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

  const spectateRoom = (roomId: string, password?: string) => {
    if (!socket) return;
    joinedRoomIdRef.current = roomId;
    socket.emit('spectateRoom', { roomId, password });
  };
  const claimSeat = (roomId: string, name: string, lobbyPassword?: string) => {
    if (!socket) return;
    joinedRoomIdRef.current = roomId;
    socket.emit('claimSeat', { roomId, name, lobbyPassword });
  };


  const leaveGame = () => {
    if (!socket) return;
    emitAction(socket, 'leaveGame', { roomId: joinedRoomIdRef.current });
    joinedRoomIdRef.current = '';
  };

  const pauseGame = (hostPassword: string, lobbyPassword: string) => {
    if (!socket) return;
    emitAction(socket, 'pauseGame', {
      roomId: joinedRoomIdRef.current,
      hostPassword,
      lobbyPassword,
    });
    // The room view unmounts after this; a stale id must not retarget the
    // bound actions until a real join sets it again.
    joinedRoomIdRef.current = '';
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
        spectateRoom,
        claimSeat,
        leaveGame,
        pauseGame,
        ...actions,
        ...addressedActions,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

const useSocket = () => useContext(SocketContext);
export { SocketProvider, useSocket };
