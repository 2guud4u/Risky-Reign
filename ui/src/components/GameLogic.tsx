import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useGameRoom } from '../contexts/GameContext';
import LobbyPage from '../pages/Lobby';
import GamePage from '../pages/Game';
import { GameRoom } from 'common/v2';

/**
 * Top-level router. Subscribes to the server's roomUpdate / gameUpdate /
 * error events, mirrors the room into the GameRoom context, and switches
 * between the Lobby (no room) and the Game (room joined) views.
 */
const GameLogic: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();
  const { setGameRoom, setCurrentPlayer, gameRoom } = useGameRoom();

  useEffect(() => {
    if (!socket) return;

    socket.on('roomUpdate', (room: GameRoom) => {
      setGameRoom(room);
      const player = room.players.find((p) => p.id === socket.id);
      setCurrentPlayer(player || null);
      setError(null);
    });

    socket.on('gameUpdate', (room: GameRoom) => {
      setGameRoom(room);
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
    <div className="app-shell">
      {!gameRoom ? <LobbyPage error={error} /> : <GamePage error={error} />}
    </div>
  );
};

export default GameLogic;
