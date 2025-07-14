import React, { useEffect, useState } from 'react';
import { useSocket } from './SocketProvider';
import LobbyPage from '../pages/Lobby';
import GamePage from '../pages/Game';
import { GameRoom, Player } from 'common';

const GameLogic: React.FC = () => {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('roomUpdate', (room: GameRoom) => {
      setGameRoom(room);
      // const player = room.players.find(p => p.id === socket.id);
      // setCurrentPlayer(player || null);
      setError(null);
      console.log("Game updated:", room);

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
  }, [socket]);

  const joinRoom = (playerName: string, roomId: string) => {
    if (!socket) return;
    
    setCurrentRoomId(roomId);
    socket.emit('joinRoom', { roomId, playerName });
  };

  const makeMove = (position: number) => {
    if (!socket || !currentRoomId) return;
    
    socket.emit('makeMove', { roomId: currentRoomId, position });
  };

  const startGame = () => {
    if (!socket || !currentRoomId) return;
    console.log('Starting game in room:', currentRoomId);
    socket.emit('startGame', { roomId: currentRoomId });
    console.log("board is ", gameRoom?.board);
  };

  const resetGame = () => {
    if (!socket || !currentRoomId) return;
    
    socket.emit('resetGame', { roomId: currentRoomId });
  };

  const refreshMap = () => {
    if (!socket || !currentRoomId) return;

    socket.emit('refreshMap', { roomId: currentRoomId });
  };

  const leaveRoom = () => {
    setGameRoom(null);
    setCurrentPlayer(null);
    setCurrentRoomId('');
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
          onJoinRoom={joinRoom}
          error={error}
        />
      ) : (<>
      <GamePage
          gameRoom={gameRoom}
          currentPlayer={currentPlayer}
          onMakeMove={makeMove}
          onResetGame={resetGame}
          onStartGame={startGame}
          onLeaveRoom={leaveRoom}
          onRefreshMap={refreshMap}
          error={error}
        />
        </>
      )}
    </div>
  );
};

export default GameLogic;