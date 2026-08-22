import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useGameRoom } from '../contexts/GameContext';
import LobbyPage from '../pages/Lobby';
import GamePage from '../pages/Game';
import { GameRoom, Player } from 'common';
import { readSavedSession, clearSavedSession } from '../utils/session';

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
  const [error, setError] = useState<string | null>(null);
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
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('gameUpdate');
      socket.off('error');
    };
  }, [socket, setGameRoom, setCurrentPlayer]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      {!gameRoom ? <LobbyPage error={error} /> : <GamePage error={error} />}
    </div>
  );
};

export default GameLogic;
