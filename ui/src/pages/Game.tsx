import React from 'react';
import { LOBBY_HEX_SIZE } from 'common/v2';
import Game from '../containers/Game';
import BoardView from '../containers/BoardView';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

const GamePage: React.FC<{ error: string | null }> = ({ error }) => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { startGame: onStartGame, refreshMap: onRefreshMap } = useSocket();

  if (!gameRoom || !currentPlayer) {
    return <p style={{ textAlign: 'center', color: '#666' }}>Loading game...</p>;
  }

  // Waiting room: players gather, then the host starts the game.
  if (gameRoom.gameStatus === 'waiting') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f0f0f0',
        }}
      >
        <div className="board-frame" style={{ maxWidth: 520, width: '100%' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>
            Waiting for Players
          </h1>
          <p style={{ textAlign: 'center', color: '#555' }}>Current Room ID: {gameRoom.id}</p>
          <p style={{ textAlign: 'center', color: '#555' }}>
            Players: {gameRoom.players.map((p) => p.name).join(', ')}
          </p>
          {error && <p style={{ color: '#dc2626', textAlign: 'center', marginTop: 8 }}>{error}</p>}
          <button
            onClick={() => onStartGame(gameRoom.id)}
            disabled={gameRoom.players.length < 2}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '10px 16px',
              background: gameRoom.players.length < 2 ? '#9ca3af' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: gameRoom.players.length < 2 ? 'not-allowed' : 'pointer',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Start Game
          </button>
          <button
            onClick={() => onRefreshMap(gameRoom.id)}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '10px 16px',
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Refresh Map
          </button>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            <BoardView hexSize={LOBBY_HEX_SIZE} />
          </div>
        </div>
      </div>
    );
  }

  return <Game />;
};

export default GamePage;
