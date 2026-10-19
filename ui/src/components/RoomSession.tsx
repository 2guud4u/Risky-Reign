import React, { useEffect, useRef, useState } from 'react';
import { PausedGameInfo, PublicGameRoom, PublicPlayer, RejoinSeat } from 'common';
import { useChrome, useGameActions, useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import ConnectionBanner from './ConnectionBanner';
import RoomPage from '../pages/Room';
import LobbyPage from '../pages/Lobby';
import RejoinPicker from '../pages/RejoinPicker';
import PausedScreen from '../pages/PausedScreen';
import CustomizeGamePage from '../editor/CustomizeGame';
import { clearSavedSession, readSavedSession, saveSession, joinCodeFromUrl } from '../utils/session';
import { TOAST_DURATION_MS } from '../constants';

/**
 * Sync the current player from a room update. Returns true if this socket is
 * still in the room; false otherwise (caller should clear the saved session).
 */
function syncCurrentPlayer(
  room: PublicGameRoom,
  socketId: string | undefined,
  setCurrentPlayer: React.Dispatch<React.SetStateAction<PublicPlayer | null>>
): boolean {
  const player = room.players.find((p) => p.id === socketId);
  setCurrentPlayer(player ?? null);
  return !!player;
}

/**
 * Top-level router + session orchestrator. Subscribes to the server's
 * roomUpdate / gameUpdate / error events, mirrors the room into the
 * GameRoom context, and switches between the Lobby (no room) and the Room
 * (joined) views.
 *
 * Also handles session persistence: on socket connect it auto-rejoins the
 * saved room (so a reload doesn't kick you back to the lobby), and clears
 * the saved session if you end up no longer in the room.
 */
const RoomSession: React.FC = () => {
  // Server-sent errors surface as a transient banner (below) so they are
  // visible in-game too, and also passed to the pages that can show them inline.
  const [error, setError] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const [view, setView] = useState<'lobby' | 'game' | 'customizeGame'>('lobby');
  const { socket, isConnected, joinRoom: onJoinRoom, spectateRoom } = useSocket();
  const { gameRoom } = useGameState();
  const { toast } = useChrome();
  const { setGameRoom, setCurrentPlayer, showToast, clearRoomState } = useGameActions();
  const autoJoinedRef = useRef(false);
  // A started game this browser holds no seat for: the rejoin picker's options.
  const [rejoin, setRejoin] = useState<{ roomId: string; seats: RejoinSeat[] } | null>(null);
  // A persisted (paused or resuming) game this browser opened a link to.
  const [paused, setPaused] = useState<PausedGameInfo | null>(null);
  // Capture a shareable join link (riskyreign.com/join?id=CODE) once on mount,
  // before the auto-rejoin effect below reads the saved session: persist the
  // code so it auto-joins, then clean the URL.
  useEffect(() => {
    const code = joinCodeFromUrl();
    if (!code) return;
    saveSession({ roomId: code, playerName: '' });
    window.history.replaceState({}, '', '/');
  }, []);

  // Join the saved room: on first connect this restores the session after a
  // reload; on every LATER reconnect it re-joins only while the app is still
  // showing that room (game, rejoin picker, paused screen). A player who left
  // for the lobby opted out — a network blip must not drag them back in.
  const roomViewRef = useRef<{ roomId?: string; rejoin?: string; paused?: string }>({});
  roomViewRef.current = { roomId: gameRoom?.id, rejoin: rejoin?.roomId, paused: paused?.roomId };
  useEffect(() => {
    if (!socket || !isConnected) return;
    const saved = readSavedSession();
    if (!saved) return;
    if (autoJoinedRef.current) {
      const v = roomViewRef.current;
      const viewingRoom =
        v.roomId === saved.roomId || v.rejoin === saved.roomId || v.paused === saved.roomId;
      if (!viewingRoom) return;
    } else {
      autoJoinedRef.current = true;
    }
    if (saved.spectating) spectateRoom(saved.roomId, saved.password);
    else onJoinRoom(saved.playerName, saved.roomId, saved.color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isConnected]);

  useEffect(() => {
    if (!socket) return;

    socket.on('roomUpdate', (room) => {
      setGameRoom(room);
      if (room.gameStatus !== 'resuming') setPaused(null);
      // Not in the room and not watching it: the saved session is stale.
      if (!syncCurrentPlayer(room, socket.id, setCurrentPlayer) && !readSavedSession()?.spectating) {
        clearSavedSession();
      }
      setError(null);
    });

    socket.on('gameUpdate', (room) => {
      setGameRoom(room);
      syncCurrentPlayer(room, socket.id, setCurrentPlayer);
      if (room.gameStatus !== 'resuming') setPaused(null);
      setError(null);
    });

    // A persisted room code: paused (waiting for the host) or resuming (the
    // lobby collecting seats). Replaces the room view until a real update
    // for a live game arrives.
    socket.on('pausedGameInfo', (info) => {
      if (info.status === 'paused') {
        clearRoomState();
        setRejoin(null);
      }
      setPaused(info);
    });

    // The saved game this browser was attached to expired server-side.
    // Read current state inside the handler (listeners stay mounted).
    socket.on('gameExpired', (data) => {
      setPaused((cur) => {
        if (cur?.roomId !== data.roomId) return cur;
        clearSavedSession();
        setError('That saved game expired — it was swept after 7 days.');
        return null;
      });
      setGameRoom((cur) => {
        if (cur?.id !== data.roomId) return cur;
        clearSavedSession();
        setError('That saved game expired — it was swept after 7 days.');
        setCurrentPlayer(null);
        return null;
      });
    });

    // A game that already started: pick your old seat or watch.
    socket.on('rejoinOptions', (data) => {
      clearRoomState();
      setRejoin(data);
    });

    socket.on('error', (errorData) => {
      setError(errorData.message);
      showToast(errorData.message);
    });

    socket.on(
      'robberFightResult',
      (r: { playerName: string; soldierRoll: number; robberRoll: number; won: boolean }) => {
        setNotice(
          r.won
            ? `${r.playerName}'s soldier rolled ${r.soldierRoll} vs the robber's ${r.robberRoll} — took the robber bag!`
            : `${r.playerName}'s soldier rolled ${r.soldierRoll} vs the robber's ${r.robberRoll} — the soldier was killed!`
        );
      }
    );

    return () => {
      socket.off('roomUpdate');
      socket.off('gameUpdate');
      socket.off('pausedGameInfo');
      socket.off('gameExpired');
      socket.off('rejoinOptions');
      socket.off('error');
      socket.off('robberFightResult');
    };
  }, [socket, setGameRoom, setCurrentPlayer, showToast, clearRoomState]);


  // Auto-dismiss the error banner after a few seconds.
  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => showToast(null), TOAST_DURATION_MS);
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [toast, showToast]);

  // Auto-dismiss the fight-result notice after a few seconds.
  useEffect(() => {
    if (!notice) return;
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), TOAST_DURATION_MS);
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, [notice]);

  // The ocean backdrop covers everything except Customize Game — the live
  // board tiles the same texture anyway, and every pre-game screen (lobby,
  // waiting room, rejoin picker, paused/resume) floats its card on the water.
  const showOceanBg = view !== 'customizeGame';

  return (
    <div className={`min-h-dvh flex flex-col items-center p-4${showOceanBg ? ' bg-ocean' : ''}`}>
      <ConnectionBanner hidden={isConnected} onRetry={() => socket?.connect()} />
      {toast && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white text-[13px] font-semibold px-4 py-2 rounded-md shadow-lg">
          {toast}
        </div>
      )}
      {notice && (
        <div className="fixed bottom-[max(3.5rem,calc(1rem+env(safe-area-inset-bottom)))] left-1/2 -translate-x-1/2 z-[100] bg-amber-600 text-white text-[13px] font-semibold px-4 py-2 rounded-md shadow-lg">
          {notice}
        </div>
      )}
      {view === 'customizeGame' ? (
        <CustomizeGamePage onBack={() => setView(gameRoom ? 'game' : 'lobby')} />
      ) : paused ? (
        <PausedScreen info={paused} onBack={() => setPaused(null)} />
      ) : gameRoom ? (
        <RoomPage error={error} onCustomizeGame={() => setView('customizeGame')} />
      ) : rejoin ? (
        <RejoinPicker roomId={rejoin.roomId} seats={rejoin.seats} onBack={() => setRejoin(null)} />
      ) : (
        <LobbyPage error={error} />
      )}
    </div>
  );
};

export default RoomSession;
