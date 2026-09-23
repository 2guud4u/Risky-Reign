import React, { useEffect, useRef, useState } from 'react';
import { GameRoom, Player } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import ConnectionBanner from './ConnectionBanner';
import GamePage from '../pages/Game';
import LobbyPage from '../pages/Lobby';
import BoardEditorPage from '../editor/BoardEditor';
import { clearSavedSession, readSavedSession } from '../utils/session';
import { TOAST_DURATION_MS } from '../constants';

/**
 * Sync the current player from a room update. Returns true if this socket is
 * still in the room; false otherwise (caller should clear the saved session).
 */
function syncCurrentPlayer(
  room: GameRoom,
  socketId: string | undefined,
  setCurrentPlayer: React.Dispatch<React.SetStateAction<Player | null>>
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
  const { socket, isConnected, joinRoom: onJoinRoom } = useSocket();
  const { setGameRoom, setCurrentPlayer, gameRoom } = useGameRoom();
  const autoJoinedRef = useRef(false);

  // Auto-rejoin the saved room once the socket is connected.
  useEffect(() => {
    if (!socket || !isConnected || autoJoinedRef.current) return;
    const saved = readSavedSession();
    if (saved) {
      autoJoinedRef.current = true;
      onJoinRoom(saved.playerName, saved.roomId, saved.color);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isConnected]);

  useEffect(() => {
    if (!socket) return;

    socket.on('roomUpdate', (room: GameRoom) => {
      setGameRoom(room);
      if (!syncCurrentPlayer(room, socket.id, setCurrentPlayer)) {
        // No longer in this room — clear the saved session.
        clearSavedSession();
      }
      setError(null);
    });

    socket.on('gameUpdate', (room: GameRoom) => {
      setGameRoom(room);
      syncCurrentPlayer(room, socket.id, setCurrentPlayer);
      setError(null);
    });

    socket.on('error', (errorData: { message: string }) => {
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

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <ConnectionBanner hidden={isConnected} />
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white text-[13px] font-semibold px-4 py-2 rounded-md shadow-lg">
          {toast}
        </div>
      )}
      {notice && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[100] bg-amber-600 text-white text-[13px] font-semibold px-4 py-2 rounded-md shadow-lg">
          {notice}
        </div>
      )}
      {view === 'boardEditor' ? (
        <BoardEditorPage
          roomId={gameRoom?.id}
          initialBoard={gameRoom?.board ?? undefined}
          onBack={() => setView(gameRoom ? 'game' : 'lobby')}
        />
      ) : gameRoom ? (
        <GamePage error={error} onCustomizeBoard={() => setView('boardEditor')} />
      ) : (
        <LobbyPage error={error} />
      )}
    </div>
  );
};

export default GameLogic;
