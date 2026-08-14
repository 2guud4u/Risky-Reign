import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import LobbyPage from '../pages/Lobby';
import GamePage from '../pages/Game';
import { GameRoom, Player } from '../common';
import { useGameRoom } from '../contexts/GameContext';
const GameLogic: React.FC = () => {

  const [error, setError] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const { socket } = useSocket();
  const { setGameRoom: setContextGameRoom, setCurrentPlayer: setContextCurrentPlayer, gameRoom } = useGameRoom();
  useEffect(() => {
    if (!socket) return;

    socket.on('roomUpdate', (room: GameRoom) => {
      setContextGameRoom(room);
      const player = room.players.find(p => p.id === socket.id);
      setContextCurrentPlayer(player || null);
      setError(null);
      console.log("Game updated:", room);

    });

    socket.on('gameUpdate', (room: GameRoom) => {
      setContextGameRoom(room);
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
  }, [socket, setContextGameRoom, setContextCurrentPlayer]);








  const leaveRoom = () => {
    setContextGameRoom(null);
    setContextCurrentPlayer(null);
    setError(null);
    // Disconnect and reconnect to clean up server state
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  };

  return (
    <div className="app">
      {!gameRoom ? (
        <LobbyPage 

          error={error}
        />
      ) : (<>
      <GamePage

          error={error}
        />
        </>
      )}
    </div>
  );
};

export default GameLogic;