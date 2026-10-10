import React, { useEffect, useRef, useState } from 'react';
import { PausedGameInfo, PublicGameRoom, PublicPlayer, RejoinSeat } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import ConnectionBanner from './ConnectionBanner';
import GamePage from '../pages/Game';
import LobbyPage from '../pages/Lobby';
import RejoinPicker from '../pages/RejoinPicker';
import PausedScreen from '../pages/PausedScreen';
import BoardEditorPage from '../editor/BoardEditor';
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
 * Top-level router. Subscribes to the server's roomUpdate / gameUpdate /
 * error events, mirrors the room into the GameRoom context, and switches
 * between the Lobby (no room) and the Game (room joined) views.
 *
 * Also handles session persistence: on socket connect it auto-rejoins the
 * saved room (so a reload doesn't kick you back to the lobby), and clears
 * the saved session if you end up no longer in the room.
 */
const GameLogic: React.FC = () => {
  // Server-sent errors surface as a transient banner (below) so they are
  // visible in-game too, and also passed to the pages that can show them inline.
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const [view, setView] = useState<'lobby' | 'game' | 'boardEditor'>('lobby');
  const { socket, isConnected, joinRoom: onJoinRoom, spectateRoom } = useSocket();
  const { setGameRoom, setCurrentPlayer, gameRoom } = useGameRoom();
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

  // Auto-rejoin the saved room once the socket is connected (as a spectator
  // if that's how this browser was watching).
  useEffect(() => {
    if (!socket || !isConnected || autoJoinedRef.current) return;
    const saved = readSavedSession();
    if (saved) {
      autoJoinedRef.current = true;
      if (saved.spectating) spectateRoom(saved.roomId);
      else onJoinRoom(saved.playerName, saved.roomId, saved.color);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isConnected]);

  useEffect(() => {
    if (!socket) return;

    socket.on('roomUpdate', (room) => {
      setGameRoom(room);
      setRejoin(null);
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
        setGameRoom(null);
        setCurrentPlayer(null);
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
      setGameRoom(null);
      setCurrentPlayer(null);
      setRejoin(data);
    });

    socket.on('error', (errorData) => {
      setError(errorData.message);
      setToast(errorData.message);
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
  }, [socket, setGameRoom, setCurrentPlayer]);

  // Auto-dismiss the error banner after a few seconds.
  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [toast]);

  // Auto-dismiss the fight-result notice after a few seconds.
  useEffect(() => {
    if (!notice) return;
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), TOAST_DURATION_MS);
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, [notice]);

  // The ocean backdrop shows on the lobby and the in-game "waiting for
  // players" room (not the game board or the board editor).
  const showOceanBg = view === 'lobby' || (view === 'game' && gameRoom != null && gameRoom.gameStatus === 'waiting');

  return (
    <div
      className="min-h-screen flex flex-col items-center p-4"
      style={
        showOceanBg
          ? {
              backgroundImage: 'url(/art/ocean.jpeg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }
          : undefined
      }
    >
      <ConnectionBanner hidden={isConnected} />
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
      {view === 'boardEditor' ? (
        <BoardEditorPage
          roomId={gameRoom?.id}
          initialBoard={gameRoom?.board ?? undefined}
          onBack={() => setView(gameRoom ? 'game' : 'lobby')}
        />
      ) : paused ? (
        <PausedScreen info={paused} onBack={() => setPaused(null)} />
      ) : gameRoom ? (
        <GamePage error={error} onCustomizeBoard={() => setView('boardEditor')} />
      ) : rejoin ? (
        <RejoinPicker roomId={rejoin.roomId} seats={rejoin.seats} onBack={() => setRejoin(null)} />
      ) : (
        <LobbyPage error={error} />
      )}
    </div>
  );
};

export default GameLogic;
